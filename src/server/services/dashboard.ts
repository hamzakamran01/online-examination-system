import "server-only"
import { and, eq, gte, inArray, isNull, sql } from "drizzle-orm"
import { db } from "@/server/db/client"
import { attempts, exams, questions } from "@/server/db/schema"
import type { SessionUser } from "@/server/auth/guards"
import { AppError } from "@/server/errors"
import { listManagedExams } from "./exams"
import { listCandidateExams } from "./attempts"

const DAY = 86_400_000
const dayKey = (d: Date) => d.toISOString().slice(0, 10)

/** Everything the examiner home needs, scoped to exams the examiner owns. */
export async function getExaminerDashboard(actor: SessionUser) {
  if (actor.role !== "examiner") throw new AppError("FORBIDDEN", "Examiner access required.")
  const now = new Date()
  const since = new Date(now.getTime() - 13 * DAY)
  since.setUTCHours(0, 0, 0, 0)

  const [list, scoreRows, subRows, bankRows] = await Promise.all([
    listManagedExams(actor),
    db
      .select({
        examId: attempts.examId,
        avg: sql<number | null>`avg(${attempts.scoreTotal} / nullif(${attempts.maxMarks}, 0)) * 100`,
        n: sql<number>`count(*)::int`,
      })
      .from(attempts)
      .innerJoin(exams, eq(exams.id, attempts.examId))
      .where(and(eq(exams.ownerId, actor.id), eq(attempts.isSandbox, false), sql`${attempts.status} <> 'in_progress'`))
      .groupBy(attempts.examId),
    db
      .select({ day: sql<string>`to_char(${attempts.submittedAt} at time zone 'UTC', 'YYYY-MM-DD')`, n: sql<number>`count(*)::int` })
      .from(attempts)
      .innerJoin(exams, eq(exams.id, attempts.examId))
      .where(and(eq(exams.ownerId, actor.id), eq(attempts.isSandbox, false), gte(attempts.submittedAt, since)))
      .groupBy(sql`1`),
    db
      .select({ type: questions.type, difficulty: questions.difficulty, n: sql<number>`count(*)::int` })
      .from(questions)
      .where(and(eq(questions.ownerId, actor.id), isNull(questions.archivedAt)))
      .groupBy(questions.type, questions.difficulty),
  ])

  const avgBy = new Map(scoreRows.map((r) => [r.examId, r.avg === null ? null : Math.round(Number(r.avg))]))
  const subsBy = new Map(subRows.map((r) => [r.day, r.n]))
  const activity = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(since.getTime() + i * DAY)
    return { date: dayKey(d), label: d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }), count: subsBy.get(dayKey(d)) ?? 0 }
  })

  const exams_ = list.map((e) => ({ ...e, avgPercent: avgBy.get(e.id) ?? null }))
  const live = exams_.filter((e) => e.stage === "live")
  const upcoming = exams_
    .filter((e) => e.stage === "scheduled" && e.startsAt.getTime() - now.getTime() < 14 * DAY)
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
  const recent = exams_
    .filter((e) => e.stage === "grading" || e.stage === "released")
    .sort((a, b) => b.endsAt.getTime() - a.endsAt.getTime())
    .slice(0, 6)

  const todo = [
    ...exams_
      .filter((e) => e.toGradeCount > 0)
      .map((e) => ({ id: `${e.id}-grade`, kind: "grade" as const, title: e.title, detail: `${e.toGradeCount} attempt${e.toGradeCount === 1 ? "" : "s"} to grade`, href: `/examiner/exams/${e.id}/results` })),
    ...exams_
      .filter((e) => e.stage === "grading" && e.toGradeCount === 0 && e.submittedCount > 0)
      .map((e) => ({ id: `${e.id}-pub`, kind: "publish" as const, title: e.title, detail: "Graded and ready to publish", href: `/examiner/exams/${e.id}/results` })),
    ...exams_
      .filter((e) => e.stage === "scheduled" && e.enrolledCount === 0)
      .map((e) => ({ id: `${e.id}-enroll`, kind: "enroll" as const, title: e.title, detail: "Scheduled with nobody enrolled", href: `/examiner/exams/${e.id}/candidates` })),
    ...exams_
      .filter((e) => e.stage === "draft")
      .map((e) => ({
        id: `${e.id}-draft`,
        kind: "draft" as const,
        title: e.title,
        detail: e.questionCount ? "Draft ready for review" : "Draft has no questions",
        href: e.questionCount ? `/examiner/exams/${e.id}/review` : `/examiner/exams/${e.id}/questions`,
      })),
  ]

  const bank = {
    total: bankRows.reduce((n, r) => n + r.n, 0),
    byType: (["single", "multi", "written"] as const).map((t) => ({ key: t, n: bankRows.filter((r) => r.type === t).reduce((a, r) => a + r.n, 0) })),
    byDifficulty: (["easy", "medium", "hard"] as const).map((d) => ({ key: d, n: bankRows.filter((r) => r.difficulty === d).reduce((a, r) => a + r.n, 0) })),
  }

  const finished = exams_.filter((e) => e.avgPercent !== null)
  return {
    now,
    counts: {
      live: live.length,
      writing: exams_.reduce((n, e) => n + e.activeCount, 0),
      toGrade: exams_.reduce((n, e) => n + e.toGradeCount, 0),
      scheduled: exams_.filter((e) => e.stage === "scheduled").length,
      drafts: exams_.filter((e) => e.stage === "draft").length,
      submitted14: activity.reduce((n, d) => n + d.count, 0),
      avgScore: finished.length ? Math.round(finished.reduce((n, e) => n + (e.avgPercent ?? 0), 0) / finished.length) : null,
    },
    live,
    upcoming,
    recent,
    todo,
    activity,
    bank,
    total: exams_.length,
  }
}

/** Candidate home: own exams plus a summary of published results. */
export async function getCandidateDashboard(actor: SessionUser) {
  const list = await listCandidateExams(actor)
  const ids = list.filter((e) => e.resultsPublishedAt && e.attempt).map((e) => e.attempt!.id)
  const scores = ids.length
    ? await db
        .select({ id: attempts.id, examId: attempts.examId, score: attempts.scoreTotal, max: attempts.maxMarks })
        .from(attempts)
        .where(and(eq(attempts.candidateId, actor.id), inArray(attempts.id, ids)))
    : []
  const byExam = new Map(scores.map((s) => [s.examId, s.max ? Math.round(((s.score ?? 0) / s.max) * 100) : 0]))
  const results = list
    .filter((e) => byExam.has(e.id))
    .map((e) => ({ id: e.id, attemptId: e.attempt!.id, title: e.title, percent: byExam.get(e.id)!, date: e.endsAt }))
    .sort((a, b) => a.date.getTime() - b.date.getTime())
  return {
    exams: list,
    results,
    counts: {
      open: list.filter((e) => e.access.kind === "open" || e.access.kind === "resume").length,
      upcoming: list.filter((e) => e.access.kind === "upcoming").length,
      completed: list.filter((e) => e.access.kind === "submitted").length,
      average: results.length ? Math.round(results.reduce((n, r) => n + r.percent, 0) / results.length) : null,
    },
  }
}
