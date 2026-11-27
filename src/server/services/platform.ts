import "server-only"
import { and, eq, gte, isNotNull, sql } from "drizzle-orm"
import { db } from "@/server/db/client"
import { attempts, answers, exams, user, enrollments } from "@/server/db/schema"
import type { SessionUser } from "@/server/auth/guards"
import { AppError } from "@/server/errors"
import { effectiveStatus } from "@/lib/domain/exam-status"
import { listAudit } from "./audit"

export async function getPlatformOverview(actor: SessionUser) {
  if (actor.role !== "admin") throw new AppError("FORBIDDEN", "Administrator access required.")
  const now = new Date()
  const timezone = process.env.APP_TIMEZONE ?? "Asia/Karachi"
  const dateKey = (date: Date) =>
    new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(
      date,
    )
  const today = dateKey(now)
  const day = 86400000
  const [people, assessments, active, submissions, pending, audit] = await Promise.all([
    db
      .select({ role: user.role, active: user.active, count: sql<number>`count(*)::int` })
      .from(user)
      .groupBy(user.role, user.active),
    db
      .select({
        id: exams.id,
        title: exams.title,
        status: exams.status,
        startsAt: exams.startsAt,
        endsAt: exams.endsAt,
        enrolled: sql<boolean>`exists(select 1 from ${enrollments} where ${enrollments.examId} = ${exams.id})`,
        pending: sql<boolean>`exists(select 1 from ${attempts} where ${attempts.examId} = ${exams.id} and not ${attempts.isSandbox} and ${attempts.status} <> 'in_progress' and ${attempts.gradingStatus} = 'pending')`,
      })
      .from(exams),
    db
      .select({ name: user.name, enabled: user.active, deadline: attempts.deadlineAt })
      .from(attempts)
      .innerJoin(user, eq(user.id, attempts.candidateId))
      .where(and(eq(attempts.status, "in_progress"), eq(attempts.isSandbox, false))),
    db
      .select({ submitted: attempts.submittedAt })
      .from(attempts)
      .where(
        and(
          eq(attempts.isSandbox, false),
          isNotNull(attempts.submittedAt),
          gte(attempts.submittedAt, new Date(+now - 14 * day)),
        ),
      ),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(answers)
      .innerJoin(attempts, eq(answers.attemptId, attempts.id))
      .where(
        sql`not ${attempts.isSandbox} and ${attempts.status} <> 'in_progress' and ${answers.manualScore} is null and ${answers.response}->>'kind' = 'text' and length(trim(${answers.response}->>'text')) > 0`,
      ),
    listAudit(actor, 10),
  ])
  const counts = new Map<string, number>()
  for (const row of submissions) {
    const key = dateKey(row.submitted!)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  const days = Array.from({ length: 14 }, (_, i) => {
    const date = dateKey(new Date(+now - (13 - i) * day))
    return { date, count: counts.get(date) ?? 0 }
  })
  const statuses = assessments.map((exam) => ({ ...exam, effective: effectiveStatus(exam, now) }))
  const disabled = active.filter((row) => !row.enabled)
  return {
    stats: {
      "Active administrators": people.find((p) => p.active && p.role === "admin")?.count ?? 0,
      "Active examiners": people.find((p) => p.active && p.role === "examiner")?.count ?? 0,
      "Active candidates": people.find((p) => p.active && p.role === "candidate")?.count ?? 0,
      "Deactivated accounts": people.filter((p) => !p.active).reduce((total, p) => total + p.count, 0),
      "Draft exams": statuses.filter((e) => e.effective === "draft").length,
      "Scheduled exams": statuses.filter((e) => e.effective === "published").length,
      "Ongoing exams": statuses.filter((e) => e.effective === "ongoing").length,
      "Completed exams": statuses.filter((e) => e.effective === "completed").length,
      "Candidates writing": active.filter((row) => row.enabled && row.deadline > now).length,
      "Submitted today": counts.get(today) ?? 0,
      "Written answers awaiting grading": pending[0].count,
    },
    attention: [
      ...statuses
        .filter((e) => e.effective === "completed" && e.pending)
        .map((e) => e.title + " has submissions awaiting grading."),
      ...statuses
        .filter((e) => e.effective === "published" && +e.startsAt <= +now + day && !e.enrolled)
        .map((e) => e.title + " starts within 24 hours and has no candidates."),
      ...disabled.map((row) => row.name + " is deactivated and still has an in-progress attempt."),
    ],
    days,
    audit,
  }
}
