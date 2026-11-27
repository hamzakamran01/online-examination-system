import "server-only"
import { and, eq, inArray } from "drizzle-orm"
import { z } from "zod"
import { db } from "@/server/db/client"
import { attempts, answers, user } from "@/server/db/schema"
import type { SessionUser } from "@/server/auth/guards"
import { getManagedExam } from "./exams"
import type { PaperItem } from "@/lib/domain/paper"

type ItemStats = {
  item: PaperItem
  seen: number
  skipped: number
  correct: number
  scored: number
  marks: number
  possible: number
  wrong: Map<string, number>
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
      const lookup = new Map(responses.map((a) => [a.attemptId + "/" + a.itemId, a]))
      const items = new Map<string, ItemStats>()
      const distribution = Array.from({ length: 10 }, (_, i) => ({ range: `${i * 10} to ${(i + 1) * 10}%`, count: 0 }))
      const candidates = records
        .map((r) => {
          for (const item of r.paper.items) {
            const stat: ItemStats = items.get(item.itemId) ?? {
              item,
              seen: 0,
              skipped: 0,
              correct: 0,
              scored: 0,
              marks: 0,
              possible: 0,
              wrong: new Map(),
            }
            stat.seen++
            const a = lookup.get(r.id + "/" + item.itemId)
            const response = a?.response
            const empty = response?.kind === "text" ? !response.text.trim() : !response?.selected.length
            if (empty) stat.skipped++
            const score = item.type === "written" ? (a?.manual ?? (empty ? 0 : null)) : (a?.auto ?? 0)
            if (score !== null) {
              stat.scored++
              stat.marks += score
              stat.possible += item.marks
            }
            if (item.type !== "written" && a?.auto === item.marks) stat.correct++
            if (response?.kind === "choice") {
              const key = r.key[item.itemId]?.correct ?? []
              for (const option of item.options)
                if (response.selected.includes(option.id) && !key.includes(option.id))
                  stat.wrong.set(option.text, (stat.wrong.get(option.text) ?? 0) + 1)
            }
            items.set(item.itemId, stat)
          }
          const score = r.score ?? 0
          const percent = r.max ? (100 * score) / r.max : 0
          distribution[Math.max(0, Math.min(9, Math.floor(percent / 10)))].count++
          return { id: r.id, name: r.name, score, max: r.max, percent, status: r.status, grading: r.grading }
        })
        .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
      const count = candidates.length,
        mid = Math.floor(count / 2)
      const stats = {
        count,
        mean: count ? candidates.reduce((n, r) => n + r.score, 0) / count : null,
        median: count ? (candidates[mid].score + candidates[Math.floor((count - 1) / 2)].score) / 2 : null,
        high: candidates[0]?.score ?? null,
        low: candidates.at(-1)?.score ?? null,
        passRate:
          exam.passMark !== null && count
            ? (100 * candidates.filter((r) => r.score >= exam.passMark!).length) / count
            : null,
      }
      const questions = Array.from(items.values(), (s) => {
        const objective = s.item.type !== "written"
        const facility = objective ? s.correct / s.seen : s.possible ? s.marks / s.possible : null
        return {
          id: s.item.itemId,
          stem: s.item.stem,
          type: s.item.type,
          seen: s.seen,
          skip: (100 * s.skipped) / s.seen,
          correct: objective ? (100 * s.correct) / s.seen : null,
          avg: s.scored ? s.marks / s.scored : null,
          max: s.scored ? s.possible / s.scored : s.item.marks,
          authored: s.item.difficulty,
          observed: facility === null ? "Pending" : facility > 0.7 ? "Easy" : facility < 0.3 ? "Hard" : "Moderate",
          wrong: Array.from(s.wrong).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? null,
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
