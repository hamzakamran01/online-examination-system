import "server-only"
import { and, eq, inArray } from "drizzle-orm"
import { z } from "zod"
import { db } from "@/server/db/client"
import { attempts, answers, user } from "@/server/db/schema"
import type { SessionUser } from "@/server/auth/guards"
import { getManagedExam } from "./exams"
import type { PaperItem } from "@/lib/domain/paper"
import { itemOutcome, type VoidRule } from "@/lib/domain/scoring"
import { loadVoids } from "./attempts"

type ItemStats = {
  item: PaperItem
  seen: number
  skipped: number
  correct: number
  graded: number
  groups: [boolean[], boolean[]]
  scored: number
  marks: number
  possible: number
  wrong: Map<string, number>
  voided: VoidRule | null
}
export function discrimination(upper: boolean[], lower: boolean[]) {
  if (!upper.length || !lower.length) return null
  return upper.filter(Boolean).length / upper.length - lower.filter(Boolean).length / lower.length
}

export function scoreBucket(percent: number) {
  return Math.max(0, Math.min(9, Math.floor(percent / 10)))
}

export function median(scores: number[]) {
  const sorted = [...scores].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length ? (sorted[middle] + sorted[Math.floor((sorted.length - 1) / 2)]) / 2 : null
}

function qualityFlags(graded: number, correct: number, index: number | null, skip: number, wrongRate: number) {
  if (graded < 5) return ["Not enough data"]
  return [
    correct < 0.2 && "Very hard or flawed",
    correct > 0.95 && "Too easy",
    index !== null && index < 0.1 && "Review wording",
    skip >= 0.3 && "Frequently skipped",
    wrongRate >= 0.4 && "Strong distractor",
  ].filter((flag): flag is string => typeof flag === "string")
}

export async function getExamAnalytics(actor: SessionUser, examId: string) {
  const exam = await getManagedExam(actor, z.uuid().parse(examId))
  return db.transaction(
    async (tx) => {
      const records = await tx
        .select({
          id: attempts.id,
          name: user.name,
          paper: attempts.paper,
          key: attempts.answerKey,
          score: attempts.scoreTotal,
          max: attempts.maxMarks,
          status: attempts.status,
          grading: attempts.gradingStatus,
        })
        .from(attempts)
        .innerJoin(user, eq(user.id, attempts.candidateId))
        .where(
          and(
            eq(attempts.examId, exam.id),
            eq(attempts.isSandbox, false),
            inArray(attempts.status, ["submitted", "auto_submitted"]),
          ),
        )
      const responses = records.length
        ? await tx
            .select({
              attemptId: answers.attemptId,
              itemId: answers.itemId,
              response: answers.response,
              manual: answers.manualScore,
              auto: answers.autoScore,
            })
            .from(answers)
            .where(
              inArray(
                answers.attemptId,
                records.map((r) => r.id),
              ),
            )
        : []
      // Voided questions (I-5.4) stay listed but are not scored, so facility and discrimination stay honest.
      const voids = await loadVoids(tx, exam.id)
      const lookup = new Map(responses.map((a) => [a.attemptId + "/" + a.itemId, a]))
      const items = new Map<string, ItemStats>()
      const distribution = Array.from({ length: 10 }, (_, i) => ({ range: `${i * 10} to ${(i + 1) * 10}%`, count: 0 }))
      const percentage = (r: (typeof records)[number]) => (r.max ? (100 * (r.score ?? 0)) / r.max : 0)
      const ranked = [...records].sort((a, b) => percentage(b) - percentage(a) || a.id.localeCompare(b.id))
      const size = Math.max(1, Math.round(ranked.length * 0.27))
      const groups = new Map<string, 0 | 1>()
      if (ranked.length >= 2) {
        for (const r of ranked.slice(0, size)) groups.set(r.id, 0)
        for (const r of ranked.slice(-size)) groups.set(r.id, 1)
      }
      const candidates = records
        .map((r) => {
          for (const item of r.paper.items) {
            const stat: ItemStats = items.get(item.itemId) ?? {
              item,
              seen: 0,
              skipped: 0,
              correct: 0,
              graded: 0,
              groups: [[], []],
              scored: 0,
              marks: 0,
              possible: 0,
              wrong: new Map(),
              voided: voids.get(item.itemId) ?? null,
            }
            stat.seen++
            const a = lookup.get(r.id + "/" + item.itemId)
            const response = a?.response
            const empty = response?.kind === "text" ? !response.text.trim() : !response?.selected.length
            if (empty) stat.skipped++
            if (stat.voided) {
              items.set(item.itemId, stat)
              continue
            }
            // Shared scoring rule: objective overrides from upheld disputes count like any other mark.
            const outcome = itemOutcome(item, a ? { autoScore: a.auto, manualScore: a.manual } : undefined, null)
            const score = item.type === "written" ? (a?.manual ?? (empty ? 0 : null)) : (outcome.score ?? 0)
            if (score !== null) {
              stat.scored++
              stat.marks += score
              stat.possible += item.marks
            }
            if (item.type !== "written" || a?.manual != null) {
              const correct = item.type === "written" ? a!.manual! >= item.marks / 2 : score === item.marks
              stat.graded++
              if (correct) stat.correct++
              const group = groups.get(r.id)
              if (group !== undefined) stat.groups[group].push(correct)
            }
            if (response?.kind === "choice") {
              const key = r.key[item.itemId]?.correct ?? []
              for (const option of item.options)
                if (response.selected.includes(option.id) && !key.includes(option.id))
                  stat.wrong.set(option.text, (stat.wrong.get(option.text) ?? 0) + 1)
            }
            items.set(item.itemId, stat)
          }
          const score = r.score ?? 0
          const percent = percentage(r)
          distribution[scoreBucket(percent)].count++
          return { id: r.id, name: r.name, score, max: r.max, percent, status: r.status, grading: r.grading }
        })
        .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
      const count = candidates.length
      const stats = {
        count,
        mean: count ? candidates.reduce((n, r) => n + r.score, 0) / count : null,
        median: median(candidates.map((r) => r.score)),
        high: candidates[0]?.score ?? null,
        low: candidates.at(-1)?.score ?? null,
        passRate:
          exam.passMark !== null && count
            ? (100 * candidates.filter((r) => r.score >= exam.passMark!).length) / count
            : null,
      }
      const questions = Array.from(items.values(), (s) => {
        const facility = s.graded ? s.correct / s.graded : null
        const index = discrimination(...s.groups)
        const wrong = Array.from(s.wrong).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]
        return {
          id: s.item.itemId,
          stem: s.item.stem,
          type: s.item.type,
          seen: s.seen,
          skip: (100 * s.skipped) / s.seen,
          correct: facility === null ? null : facility * 100,
          index,
          discriminationLabel:
            index === null
              ? "Unavailable"
              : index < 0
                ? "Review: stronger candidates did worse"
                : index < 0.1
                  ? "Review"
                  : index < 0.3
                    ? "Fair"
                    : "Good",
          flags: qualityFlags(s.graded, facility ?? 0, index, s.skipped / s.seen, (wrong?.[1] ?? 0) / s.seen),
          avg: s.scored ? s.marks / s.scored : null,
          max: s.scored ? s.possible / s.scored : s.item.marks,
          authored: s.item.difficulty,
          observed: facility === null ? "Pending" : facility > 0.7 ? "Easy" : facility < 0.3 ? "Hard" : "Moderate",
          wrong: wrong?.[0] ?? null,
          voided: s.voided,
        }
      })
      return {
        exam: {
          title: exam.title,
          startsAt: exam.startsAt,
          endsAt: exam.endsAt,
          durationMin: exam.durationMin,
          totalMarks: exam.totalMarks,
          passMark: exam.passMark,
        },
        stats,
        distribution,
        candidates,
        questions,
      }
    },
    { isolationLevel: "repeatable read", accessMode: "read only" },
  )
}
export type ExamAnalytics = Awaited<ReturnType<typeof getExamAnalytics>>
