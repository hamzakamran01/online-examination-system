import "server-only"
import { and, asc, eq, inArray, ne } from "drizzle-orm"
import { db } from "@/server/db/client"
import { answers, attempts, exams } from "@/server/db/schema"
import type { SessionUser } from "@/server/auth/guards"
import { AppError } from "@/server/errors"

const r1 = (n: number) => Math.round(n * 10) / 10

type Cell = { index: number; type: "single" | "multi" | "written"; topic: string | null; marks: number; max: number; answered: boolean }

/**
 * The candidate's own transcript (C-3.8.1). Marks, breakdowns and feedback are
 * included only for exams whose results are published; everything else shows
 * as awaiting results. Never includes answer keys or other candidates' data.
 */
export async function getCandidateTranscript(actor: SessionUser) {
  if (actor.role !== "candidate") throw new AppError("FORBIDDEN", "Only candidates have a transcript.")
  const rows = await db
    .select({ attempt: attempts, exam: exams })
    .from(attempts)
    .innerJoin(exams, eq(exams.id, attempts.examId))
    .where(and(eq(attempts.candidateId, actor.id), eq(attempts.isSandbox, false), ne(attempts.status, "in_progress")))
    .orderBy(asc(attempts.submittedAt))

  const publishedIds = rows.filter((r) => r.exam.resultsPublishedAt).map((r) => r.attempt.id)
  const ans = publishedIds.length ? await db.select().from(answers).where(inArray(answers.attemptId, publishedIds)) : []
  const byAttempt = new Map<string, Map<string, (typeof ans)[number]>>()
  for (const a of ans) {
    if (!byAttempt.has(a.attemptId)) byAttempt.set(a.attemptId, new Map())
    byAttempt.get(a.attemptId)!.set(a.itemId, a)
  }

  const entries = rows.map(({ attempt, exam }) => {
    const published = Boolean(exam.resultsPublishedAt)
    const base = {
      attemptId: attempt.id,
      examId: exam.id,
      title: exam.title,
      submittedAt: attempt.submittedAt,
      submitReason: attempt.submitReason,
      questionCount: attempt.paper.items.length,
      maxMarks: attempt.maxMarks,
      published,
    }
    if (!published) return { ...base, score: null, percent: null, passed: null, cells: [] as Cell[], topics: [], types: [] }

    const map = byAttempt.get(attempt.id) ?? new Map()
    const cells: Cell[] = attempt.paper.items.map((item, index) => {
      const a = map.get(item.itemId)
      const marks = item.type === "written" ? (a?.manualScore ?? 0) : (a?.autoScore ?? 0)
      const resp = a?.response
      const answered = !!resp && (resp.kind === "choice" ? resp.selected.length > 0 : resp.text.trim().length > 0)
      return { index, type: item.type, topic: item.topic, marks, max: item.marks, answered }
    })
    const group = <K extends string>(key: (c: Cell) => K) => {
      const m = new Map<K, { earned: number; max: number; n: number }>()
      for (const c of cells) {
        const k = key(c)
        const g = m.get(k) ?? { earned: 0, max: 0, n: 0 }
        g.earned += c.marks
        g.max += c.max
        g.n++
        m.set(k, g)
      }
      return [...m.entries()].map(([k, g]) => ({ key: k, earned: r1(g.earned), max: r1(g.max), n: g.n, percent: g.max ? Math.round((g.earned / g.max) * 100) : 0 }))
    }
    const score = attempt.scoreTotal ?? 0
    const percent = attempt.maxMarks ? Math.round((score / attempt.maxMarks) * 100) : 0
    return {
      ...base,
      score,
      percent,
      passed: exam.passMark === null || exam.passMark <= 0 ? null : score >= exam.passMark,
      cells,
      topics: group((c) => c.topic ?? "General").sort((a, b) => b.percent - a.percent),
      types: group((c) => c.type),
    }
  })

  const scored = entries.filter((e) => e.percent !== null) as (typeof entries[number] & { percent: number })[]
  const last = scored.at(-1)
  const prev = scored.at(-2)
  const allCells = scored.flatMap((e) => e.cells)
  const objective = allCells.filter((c) => c.type !== "written")

  return {
    entries: entries.slice().reverse(),
    trend: scored.map((e) => ({ title: e.title, percent: e.percent, date: e.submittedAt })),
    stats: {
      sat: entries.length,
      published: scored.length,
      awaiting: entries.length - scored.length,
      average: scored.length ? Math.round(scored.reduce((n, e) => n + e.percent, 0) / scored.length) : null,
      best: scored.length ? Math.max(...scored.map((e) => e.percent)) : null,
      passed: scored.filter((e) => e.passed === true).length,
      withPassMark: scored.filter((e) => e.passed !== null).length,
      delta: last && prev ? last.percent - prev.percent : null,
      objectiveAccuracy: objective.length ? Math.round((objective.filter((c) => c.marks >= c.max).length / objective.length) * 100) : null,
      answeredRate: allCells.length ? Math.round((allCells.filter((c) => c.answered).length / allCells.length) * 100) : null,
    },
  }
}
export type Transcript = Awaited<ReturnType<typeof getCandidateTranscript>>
