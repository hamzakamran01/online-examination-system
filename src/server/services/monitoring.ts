import "server-only"
import { and, asc, desc, eq, gt, sql } from "drizzle-orm"
import { db } from "@/server/db/client"
import { announcements, answers, attemptEvents, attempts, enrollments, timeExtensions, user } from "@/server/db/schema"
import type { SessionUser } from "@/server/auth/guards"
import { AppError, notFound } from "@/server/errors"
import { effectiveStatus, type EffectiveStatus } from "@/lib/domain/exam-status"
import { EXTENSION_CAP_SEC, REVIEW_SIGNAL_TYPES, deriveLiveState, type LiveState } from "@/lib/domain/monitoring"
import { announcementSchema, extensionSchema, type AnnouncementInput, type ExtensionInput } from "@/lib/validation/monitoring"
import { getManagedExam } from "./exams"
import { finalizeExpiredForExam } from "./attempts"
import { audit } from "./audit"

const signalList = sql.raw(REVIEW_SIGNAL_TYPES.map((t) => `'${t}'`).join(", "))

export type MonitorRow = {
  candidateId: string
  name: string
  email: string
  state: LiveState
  attemptId: string | null
  answered: number
  total: number
  startedAt: string | null
  deadlineAt: string | null
  submittedAt: string | null
  submitReason: "candidate" | "timeout" | "examiner" | null
  lastSeenAt: string | null
  signals: number
  gapSec: number
  extensionSec: number
}

export type MonitorView = {
  exam: { id: string; title: string; status: EffectiveStatus; startsAt: string; endsAt: string }
  serverNow: string
  canAct: boolean
  summary: Record<LiveState, number> & { enrolled: number; signals: number }
  rows: MonitorRow[]
  announcements: { id: string; body: string; createdAt: string; author: string | null }[]
}

/**
 * Live monitor (C-3.6.1). Server data only: states derive from the server clock,
 * answered counts from saved answers, signals from attempt_events.
 * Expired attempts are finalized first so the board never shows a ghost "writing" row.
 * Sandbox attempts are excluded (invariant 6).
 */
export async function getExamMonitor(actor: SessionUser, examId: string): Promise<MonitorView> {
  const exam = await getManagedExam(actor, examId)
  await finalizeExpiredForExam(examId)
  const now = new Date()

  const rows = await db
    .select({
      candidateId: user.id,
      name: user.name,
      email: user.email,
      attemptId: attempts.id,
      status: attempts.status,
      startedAt: attempts.startedAt,
      deadlineAt: attempts.deadlineAt,
      submittedAt: attempts.submittedAt,
      submitReason: attempts.submitReason,
      lastSeenAt: attempts.lastSeenAt,
      extensionSec: attempts.extensionSec,
      total: sql<number>`coalesce(jsonb_array_length(${attempts.paper}->'items'), 0)::int`,
      answered: sql<number>`(select count(*)::int from ${answers} a where a.attempt_id = ${attempts.id} and a.response is not null)`,
      signals: sql<number>`(select count(*)::int from ${attemptEvents} e where e.attempt_id = ${attempts.id} and e.type in (${signalList}))`,
      gapSec: sql<number>`(select coalesce(sum((e.detail->>'gapSec')::int), 0)::int from ${attemptEvents} e where e.attempt_id = ${attempts.id} and e.type = 'connection_gap')`,
    })
    .from(enrollments)
    .innerJoin(user, eq(user.id, enrollments.candidateId))
    .leftJoin(attempts, and(eq(attempts.examId, enrollments.examId), eq(attempts.candidateId, enrollments.candidateId), eq(attempts.isSandbox, false)))
    .where(eq(enrollments.examId, examId))
    .orderBy(asc(user.name))

  const notes = await db
    .select({ id: announcements.id, body: announcements.body, createdAt: announcements.createdAt, author: user.name })
    .from(announcements)
    .leftJoin(user, eq(user.id, announcements.authorId))
    .where(eq(announcements.examId, examId))
    .orderBy(desc(announcements.createdAt))
    .limit(50)

  const summary = { enrolled: rows.length, not_started: 0, writing: 0, disconnected: 0, submitted: 0, signals: 0 }
  const out: MonitorRow[] = rows.map((r) => {
    const attempt = r.attemptId && r.status && r.startedAt ? { status: r.status, lastSeenAt: r.lastSeenAt, startedAt: r.startedAt } : null
    const state = deriveLiveState(attempt, now)
    summary[state]++
    summary.signals += r.signals ?? 0
    return {
      candidateId: r.candidateId,
      name: r.name,
      email: r.email,
      state,
      attemptId: r.attemptId,
      answered: r.attemptId ? r.answered : 0,
      total: r.attemptId ? r.total : 0,
      startedAt: r.startedAt?.toISOString() ?? null,
      deadlineAt: r.deadlineAt?.toISOString() ?? null,
      submittedAt: r.submittedAt?.toISOString() ?? null,
      submitReason: r.submitReason,
      lastSeenAt: r.lastSeenAt?.toISOString() ?? null,
      signals: r.attemptId ? r.signals : 0,
      gapSec: r.attemptId ? r.gapSec : 0,
      extensionSec: r.extensionSec ?? 0,
    }
  })

  const status = effectiveStatus(exam, now)
  return {
    exam: { id: exam.id, title: exam.title, status, startsAt: exam.startsAt.toISOString(), endsAt: exam.endsAt.toISOString() },
    serverNow: now.toISOString(),
    canAct: actor.role === "examiner" && exam.ownerId === actor.id,
    summary,
    rows: out,
    announcements: notes.map((n) => ({ id: n.id, body: n.body, createdAt: n.createdAt.toISOString(), author: n.author })),
  }
}

export type TimelineView = {
  candidate: { name: string; email: string }
  attempt: { id: string; status: string; startedAt: string; deadlineAt: string; submittedAt: string | null; extensionSec: number }
  events: { id: string; type: string; source: "client" | "server"; detail: Record<string, unknown>; serverTs: string; clientTs: string | null }[]
  extensions: { id: string; seconds: number; reason: string; grantedBy: string | null; createdAt: string }[]
}

/** Event timeline for one attempt (C-3.6.3). Owner examiner or admin; foreign ids are 404. */
export async function getAttemptTimeline(actor: SessionUser, examId: string, attemptId: string): Promise<TimelineView> {
  await getManagedExam(actor, examId)
  const [a] = await db
    .select({
      id: attempts.id,
      status: attempts.status,
      startedAt: attempts.startedAt,
      deadlineAt: attempts.deadlineAt,
      submittedAt: attempts.submittedAt,
      extensionSec: attempts.extensionSec,
      name: user.name,
      email: user.email,
    })
    .from(attempts)
    .innerJoin(user, eq(user.id, attempts.candidateId))
    .where(and(eq(attempts.id, attemptId), eq(attempts.examId, examId), eq(attempts.isSandbox, false)))
  if (!a) throw notFound("Attempt")

  const granter = sql<string | null>`(select u.name from ${user} u where u.id = ${timeExtensions.grantedBy})`
  const [events, ext] = await Promise.all([
    db
      .select({
        id: attemptEvents.id,
        type: attemptEvents.type,
        source: attemptEvents.source,
        detail: attemptEvents.detail,
        serverTs: attemptEvents.serverTs,
        clientTs: attemptEvents.clientTs,
      })
      .from(attemptEvents)
      .where(eq(attemptEvents.attemptId, attemptId))
      .orderBy(asc(attemptEvents.serverTs))
      .limit(500),
    db
      .select({ id: timeExtensions.id, seconds: timeExtensions.seconds, reason: timeExtensions.reason, grantedBy: granter, createdAt: timeExtensions.createdAt })
      .from(timeExtensions)
      .where(eq(timeExtensions.attemptId, attemptId))
      .orderBy(asc(timeExtensions.createdAt)),
  ])

  return {
    candidate: { name: a.name, email: a.email },
    attempt: {
      id: a.id,
      status: a.status,
      startedAt: a.startedAt.toISOString(),
      deadlineAt: a.deadlineAt.toISOString(),
      submittedAt: a.submittedAt?.toISOString() ?? null,
      extensionSec: a.extensionSec,
    },
    events: events.map((e) => ({ ...e, serverTs: e.serverTs.toISOString(), clientTs: e.clientTs?.toISOString() ?? null })),
    extensions: ext.map((x) => ({ ...x, createdAt: x.createdAt.toISOString() })),
  }
}

/**
 * Announcement to every candidate of the exam (C-3.6.2). Owner only, while the
 * exam is scheduled or running. A repeated identical post within 30 s (double
 * click, retry) returns the first one instead of creating a duplicate.
 */
export async function postAnnouncement(actor: SessionUser, examId: string, raw: AnnouncementInput) {
  const input = announcementSchema.parse(raw)
  if (actor.role !== "examiner") throw new AppError("FORBIDDEN", "Only the exam owner can post announcements.")
  return db.transaction(async (tx) => {
    const exam = await getManagedExam(actor, examId, { tx, write: true })
    const status = effectiveStatus(exam)
    if (status === "draft") throw new AppError("CONFLICT", "Publish the exam before posting announcements.")
    if (status === "completed") throw new AppError("CONFLICT", "This exam has ended. Announcements are no longer delivered.")

    const [dup] = await tx
      .select({ id: announcements.id })
      .from(announcements)
      .where(
        and(
          eq(announcements.examId, examId),
          eq(announcements.authorId, actor.id),
          eq(announcements.body, input.body),
          gt(announcements.createdAt, new Date(Date.now() - 30_000))
        )
      )
      .limit(1)
    if (dup) return { id: dup.id, duplicate: true }

    const [row] = await tx.insert(announcements).values({ examId, authorId: actor.id, body: input.body }).returning({ id: announcements.id })
    await audit(tx, actor.id, "exam.announcement_posted", "exam", examId, { announcementId: row.id, length: input.body.length })
    return { id: row.id, duplicate: false }
  })
}

/**
 * Examiner-granted extra time (I-5.3). Never automatic: the examiner decides,
 * using the server-measured outage as evidence. Reason required, capped per
 * attempt, row locked so two concurrent grants cannot exceed the cap, audited.
 * The candidate learns about it on the next heartbeat (deadline moves, notice shown).
 */
export async function grantExtension(actor: SessionUser, raw: ExtensionInput) {
  const input = extensionSchema.parse(raw)
  if (actor.role !== "examiner") throw new AppError("FORBIDDEN", "Only the exam owner can grant extra time.")
  const seconds = input.minutes * 60
  const now = new Date()

  return db.transaction(async (tx) => {
    const [a] = await tx.select().from(attempts).where(eq(attempts.id, input.attemptId)).for("update")
    if (!a || a.isSandbox) throw notFound("Attempt")
    // Ownership check without locking the exam row (avoids lock-order inversion with closeExam).
    await getManagedExam(actor, a.examId, { write: true })
    if (a.status !== "in_progress") throw new AppError("CONFLICT", "This attempt is already submitted. Extra time can only be given while the candidate is writing.")
    if (a.deadlineAt <= now) throw new AppError("CONFLICT", "This attempt's time has already run out, so it is being finalized.")
    const room = EXTENSION_CAP_SEC - a.extensionSec
    if (seconds > room)
      throw new AppError(
        "VALIDATION",
        room > 0
          ? `Only ${Math.floor(room / 60)} more minute${room >= 120 ? "s" : ""} can be granted to this attempt (limit ${EXTENSION_CAP_SEC / 60} minutes in total).`
          : `This attempt already has the maximum ${EXTENSION_CAP_SEC / 60} minutes of extra time.`,
        { minutes: "Over the limit for this attempt." }
      )

    const deadlineAt = new Date(a.deadlineAt.getTime() + seconds * 1000)
    await tx.update(attempts).set({ deadlineAt, extensionSec: a.extensionSec + seconds }).where(eq(attempts.id, a.id))
    const [ext] = await tx
      .insert(timeExtensions)
      .values({ attemptId: a.id, seconds, reason: input.reason, grantedBy: actor.id })
      .returning({ id: timeExtensions.id })
    await tx.insert(attemptEvents).values({ attemptId: a.id, type: "extension_granted", source: "server", detail: { seconds, extensionId: ext.id } })
    await audit(tx, actor.id, "attempt.extension_granted", "attempt", a.id, {
      seconds,
      reason: input.reason,
      previousDeadline: a.deadlineAt.toISOString(),
      newDeadline: deadlineAt.toISOString(),
    })
    return { deadlineAt: deadlineAt.toISOString(), extensionSec: a.extensionSec + seconds, examId: a.examId }
  })
}
