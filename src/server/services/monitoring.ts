import "server-only"
import { and, asc, desc, eq, gt, gte, inArray, sql } from "drizzle-orm"
import { db, type Db, type Tx } from "@/server/db/client"
import { announcements, answers, attemptEvents, attempts, enrollments, examIncidents, timeExtensions, user } from "@/server/db/schema"
import type { SessionUser } from "@/server/auth/guards"
import { AppError, notFound } from "@/server/errors"
import { effectiveStatus, type EffectiveStatus } from "@/lib/domain/exam-status"
import {
  EXTENSION_CAP_SEC,
  OUTAGE_CAUSES,
  REVIEW_SIGNAL_TYPES,
  SIGNAL_LABEL,
  deriveLiveState,
  type GapCause,
  type LiveState,
} from "@/lib/domain/monitoring"
import { outageInWindow, planCompensation, type CompensationStatus, type GapSpan } from "@/lib/domain/incidents"
import {
  announcementSchema,
  declareIncidentSchema,
  extensionSchema,
  incidentWindowSchema,
  type AnnouncementInput,
  type DeclareIncidentInput,
  type ExtensionInput,
  type IncidentWindowInput,
} from "@/lib/validation/monitoring"
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
  backgroundSec: number
  extensionSec: number
}

export type MonitorView = {
  exam: { id: string; title: string; status: EffectiveStatus; startsAt: string; endsAt: string }
  serverNow: string
  canAct: boolean
  summary: Record<LiveState, number> & { enrolled: number; signals: number }
  rows: MonitorRow[]
  announcements: { id: string; body: string; createdAt: string; author: string | null }[]
  incidents: { id: string; windowFrom: string; windowTo: string; reason: string; affected: number; totalSec: number; createdAt: string; declaredBy: string | null }[]
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
      // Background-tab silences are kept on the timeline but are not outages (I-5.3).
      gapSec: sql<number>`(select coalesce(sum((e.detail->>'gapSec')::int), 0)::int from ${attemptEvents} e where e.attempt_id = ${attempts.id} and e.type = 'connection_gap' and coalesce(e.detail->>'cause', 'no_contact') <> 'background_tab')`,
      backgroundSec: sql<number>`(select coalesce(sum((e.detail->>'gapSec')::int), 0)::int from ${attemptEvents} e where e.attempt_id = ${attempts.id} and e.type = 'connection_gap' and e.detail->>'cause' = 'background_tab')`,
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

  const incidentRows = await db
    .select({
      id: examIncidents.id,
      windowFrom: examIncidents.windowFrom,
      windowTo: examIncidents.windowTo,
      reason: examIncidents.reason,
      affected: examIncidents.affected,
      totalSec: examIncidents.totalSec,
      createdAt: examIncidents.createdAt,
      declaredBy: user.name,
    })
    .from(examIncidents)
    .leftJoin(user, eq(user.id, examIncidents.declaredBy))
    .where(eq(examIncidents.examId, examId))
    .orderBy(desc(examIncidents.createdAt))
    .limit(20)

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
      backgroundSec: r.attemptId ? r.backgroundSec : 0,
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
    incidents: incidentRows.map((i) => ({
      ...i,
      windowFrom: i.windowFrom.toISOString(),
      windowTo: i.windowTo.toISOString(),
      createdAt: i.createdAt.toISOString(),
    })),
  }
}

export type TimelineView = {
  candidate: { name: string; email: string }
  attempt: { id: string; status: string; startedAt: string; deadlineAt: string; submittedAt: string | null; extensionSec: number }
  events: { id: string; type: string; source: "client" | "server"; detail: Record<string, unknown>; serverTs: string; clientTs: string | null }[]
  extensions: { id: string; seconds: number; reason: string; grantedBy: string | null; createdAt: string; incidentId: string | null }[]
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
      .select({
        id: timeExtensions.id,
        seconds: timeExtensions.seconds,
        reason: timeExtensions.reason,
        grantedBy: granter,
        createdAt: timeExtensions.createdAt,
        incidentId: timeExtensions.incidentId,
      })
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

/* ----------------------------------------------------------------------------
 * Declared incidents (I-5.3): compensate everyone an outage affected, at once
 * ------------------------------------------------------------------------- */
export type IncidentPlanRow = {
  attemptId: string
  name: string
  email: string
  outageSec: number
  stillOut: boolean
  compensatedSec: number
  extensionSec: number
  status: CompensationStatus
  seconds: number
}
export type IncidentPlan = {
  from: string
  to: string
  serverNow: string
  rows: IncidentPlanRow[]
  eligible: number
  totalSec: number
  submittedSkipped: number
}

/**
 * Builds the compensation plan for a declared outage window from server data only:
 * measured connection gaps (outage causes), silences still running, and extra time
 * already granted since the window opened. Used by the preview AND inside the grant
 * transaction, so the examiner approves exactly what is applied.
 */
async function buildIncidentPlan(tx: Tx | Db, examId: string, from: Date, to: Date, now: Date): Promise<IncidentPlan> {
  const rows = await tx
    .select({
      attemptId: attempts.id,
      name: user.name,
      email: user.email,
      status: attempts.status,
      deadlineAt: attempts.deadlineAt,
      lastSeenAt: attempts.lastSeenAt,
      extensionSec: attempts.extensionSec,
    })
    .from(attempts)
    .innerJoin(user, eq(user.id, attempts.candidateId))
    .where(and(eq(attempts.examId, examId), eq(attempts.isSandbox, false)))
    .orderBy(asc(attempts.id))
  const live = rows.filter((r) => r.status === "in_progress")
  const ids = live.map((r) => r.attemptId)

  const gaps = ids.length
    ? await tx
        .select({ attemptId: attemptEvents.attemptId, detail: attemptEvents.detail })
        .from(attemptEvents)
        .where(and(inArray(attemptEvents.attemptId, ids), eq(attemptEvents.type, "connection_gap")))
    : []
  // Extra time granted since the outage began already compensates it (manual or incident).
  const granted = ids.length
    ? await tx
        .select({ attemptId: timeExtensions.attemptId, sec: sql<number>`sum(${timeExtensions.seconds})::int` })
        .from(timeExtensions)
        .where(and(inArray(timeExtensions.attemptId, ids), gte(timeExtensions.createdAt, from)))
        .groupBy(timeExtensions.attemptId)
    : []
  const spans = new Map<string, GapSpan[]>()
  for (const g of gaps) {
    const d = g.detail as { from?: string; to?: string; cause?: GapCause }
    if (!d.from || !d.to) continue
    const list = spans.get(g.attemptId) ?? []
    list.push({ from: Date.parse(d.from), to: Date.parse(d.to), cause: d.cause ?? null })
    spans.set(g.attemptId, list)
  }
  const grantedBy = new Map(granted.map((g) => [g.attemptId, g.sec]))

  const plan: IncidentPlanRow[] = live.map((r) => {
    const silentSince = r.lastSeenAt ? r.lastSeenAt.getTime() : null
    const out = outageInWindow(spans.get(r.attemptId) ?? [], silentSince, now.getTime(), from.getTime(), to.getTime())
    const compensatedSec = grantedBy.get(r.attemptId) ?? 0
    const c = planCompensation({
      outageSec: out.sec,
      compensatedSec,
      extensionSec: r.extensionSec,
      deadlineAt: r.deadlineAt.getTime(),
      now: now.getTime(),
    })
    return {
      attemptId: r.attemptId,
      name: r.name,
      email: r.email,
      outageSec: out.sec,
      stillOut: out.stillOut,
      compensatedSec,
      extensionSec: r.extensionSec,
      status: c.status,
      seconds: c.seconds,
    }
  })
  plan.sort(
    (a, b) =>
      Number(b.status === "eligible") - Number(a.status === "eligible") || b.outageSec - a.outageSec || a.name.localeCompare(b.name)
  )
  const eligible = plan.filter((p) => p.status === "eligible")
  return {
    from: from.toISOString(),
    to: to.toISOString(),
    serverNow: now.toISOString(),
    rows: plan,
    eligible: eligible.length,
    totalSec: eligible.reduce((s, p) => s + p.seconds, 0),
    submittedSkipped: rows.length - live.length,
  }
}

function checkWindow(to: Date, exam: { startsAt: Date }, now: Date) {
  if (to.getTime() > now.getTime() + 60_000)
    throw new AppError("VALIDATION", "The window cannot end in the future. Declare an outage once it has happened.", {
      to: "Must not be in the future.",
    })
  if (to.getTime() <= exam.startsAt.getTime())
    throw new AppError("VALIDATION", "That window ends before the exam started.", { to: "Must be after the exam start." })
}

/** Preview who an outage window affected and what each would receive. Owner examiner, or admin read only. */
export async function previewIncident(actor: SessionUser, examId: string, raw: IncidentWindowInput) {
  const input = incidentWindowSchema.parse(raw)
  const exam = await getManagedExam(actor, examId)
  const now = new Date()
  checkWindow(new Date(input.to), exam, now)
  const to = new Date(Math.min(Date.parse(input.to), now.getTime()))
  return buildIncidentPlan(db, exam.id, new Date(input.from), to, now)
}

/**
 * Grants every affected candidate their own measured loss inside the window, under one
 * audited reason (I-5.3). One transaction: the exam row and then every live attempt are
 * locked (the same order as closing an exam, so no deadlock), the plan is rebuilt from
 * locked data, and the request key makes a retried or double-clicked grant apply once.
 */
export async function declareIncident(actor: SessionUser, examId: string, raw: DeclareIncidentInput) {
  const input = declareIncidentSchema.parse(raw)
  if (actor.role !== "examiner") throw new AppError("FORBIDDEN", "Only the exam owner can declare an incident.")
  const now = new Date()
  return db.transaction(async (tx) => {
    const exam = await getManagedExam(actor, examId, { tx, write: true })
    const [dup] = await tx
      .select()
      .from(examIncidents)
      .where(and(eq(examIncidents.examId, exam.id), eq(examIncidents.requestKey, input.requestKey)))
    if (dup) return { incidentId: dup.id, affected: dup.affected, totalSec: dup.totalSec, duplicate: true }

    checkWindow(new Date(input.to), exam, now)
    const from = new Date(input.from)
    const to = new Date(Math.min(Date.parse(input.to), now.getTime()))

    await tx
      .select({ id: attempts.id })
      .from(attempts)
      .where(and(eq(attempts.examId, exam.id), eq(attempts.isSandbox, false), eq(attempts.status, "in_progress")))
      .orderBy(asc(attempts.id))
      .for("update")
    const plan = await buildIncidentPlan(tx, exam.id, from, to, now)
    const eligible = plan.rows.filter((r) => r.status === "eligible")
    if (!eligible.length)
      throw new AppError(
        "CONFLICT",
        "No candidate still writing lost contact in that window, or they are already compensated. Nothing was changed."
      )

    const [incident] = await tx
      .insert(examIncidents)
      .values({
        examId: exam.id,
        windowFrom: from,
        windowTo: to,
        reason: input.reason,
        declaredBy: actor.id,
        requestKey: input.requestKey,
        affected: eligible.length,
        totalSec: plan.totalSec,
      })
      .returning({ id: examIncidents.id })

    for (const r of eligible) {
      const [a] = await tx
        .update(attempts)
        .set({
          deadlineAt: sql`${attempts.deadlineAt} + make_interval(secs => ${r.seconds})`,
          extensionSec: sql`${attempts.extensionSec} + ${r.seconds}`,
        })
        .where(eq(attempts.id, r.attemptId))
        .returning({ deadlineAt: attempts.deadlineAt })
      const [ext] = await tx
        .insert(timeExtensions)
        .values({ attemptId: r.attemptId, seconds: r.seconds, reason: input.reason, grantedBy: actor.id, incidentId: incident.id })
        .returning({ id: timeExtensions.id })
      await tx.insert(attemptEvents).values({
        attemptId: r.attemptId,
        type: "extension_granted",
        source: "server",
        detail: { seconds: r.seconds, extensionId: ext.id, incidentId: incident.id, measuredSec: r.outageSec },
      })
      await audit(tx, actor.id, "attempt.extension_granted", "attempt", r.attemptId, {
        seconds: r.seconds,
        measuredSec: r.outageSec,
        reason: input.reason,
        incidentId: incident.id,
        newDeadline: a.deadlineAt.toISOString(),
      })
    }
    await audit(tx, actor.id, "exam.incident_declared", "exam", exam.id, {
      incidentId: incident.id,
      from: from.toISOString(),
      to: to.toISOString(),
      reason: input.reason,
      affected: eligible.length,
      totalSec: plan.totalSec,
      grants: eligible.map((r) => ({ attemptId: r.attemptId, seconds: r.seconds, measuredSec: r.outageSec })),
      skipped: plan.rows.filter((r) => r.status !== "eligible").map((r) => ({ attemptId: r.attemptId, status: r.status })),
    })
    return { incidentId: incident.id, affected: eligible.length, totalSec: plan.totalSec, duplicate: false }
  })
}

/* ----------------------------------------------------------------------------
 * Attempt evidence (I-5.3, I-5.4): what the grader and the dispute reviewer see.
 * Callers must have authorized the attempt already (owner examiner or admin).
 * ------------------------------------------------------------------------- */
export type AttemptEvidence = {
  outageSec: number
  backgroundSec: number
  gaps: { sec: number; cause: GapCause; from: string | null; to: string | null }[]
  signals: { type: string; label: string; count: number }[]
  deviceChanges: number
  lateSaves: number
  extensions: { seconds: number; reason: string; at: string; incident: boolean }[]
  summary: string
}

export async function getAttemptEvidence(attemptId: string): Promise<AttemptEvidence> {
  const [events, ext] = await Promise.all([
    db
      .select({ type: attemptEvents.type, detail: attemptEvents.detail })
      .from(attemptEvents)
      .where(eq(attemptEvents.attemptId, attemptId))
      .orderBy(asc(attemptEvents.serverTs))
      .limit(1000),
    db
      .select({
        seconds: timeExtensions.seconds,
        reason: timeExtensions.reason,
        at: timeExtensions.createdAt,
        incidentId: timeExtensions.incidentId,
      })
      .from(timeExtensions)
      .where(eq(timeExtensions.attemptId, attemptId))
      .orderBy(asc(timeExtensions.createdAt)),
  ])
  const gaps: AttemptEvidence["gaps"] = []
  const counts = new Map<string, number>()
  for (const e of events) {
    if (e.type === "connection_gap") {
      const d = e.detail as { gapSec?: number; cause?: GapCause; from?: string; to?: string }
      gaps.push({ sec: d.gapSec ?? 0, cause: d.cause ?? "no_contact", from: d.from ?? null, to: d.to ?? null })
    } else if ((REVIEW_SIGNAL_TYPES as readonly string[]).includes(e.type)) counts.set(e.type, (counts.get(e.type) ?? 0) + 1)
  }
  const outageSec = gaps.filter((g) => OUTAGE_CAUSES.includes(g.cause)).reduce((s, g) => s + g.sec, 0)
  const backgroundSec = gaps.filter((g) => g.cause === "background_tab").reduce((s, g) => s + g.sec, 0)
  const extensionSec = ext.reduce((s, x) => s + x.seconds, 0)
  const deviceChanges = counts.get("device_change") ?? 0
  const lateSaves = counts.get("late_save_rejected") ?? 0
  const min = (sec: number) => (sec < 60 ? `${sec} s` : `${Math.round(sec / 60)} min`)

  const parts: string[] = []
  if (outageSec) parts.push(`${min(outageSec)} of server-measured outage`)
  if (extensionSec) parts.push(`${min(extensionSec)} of extra time granted`)
  if (deviceChanges) parts.push(`continued on another device ${deviceChanges === 1 ? "once" : `${deviceChanges} times`}`)
  if (lateSaves) parts.push(`${lateSaves} late save${lateSaves === 1 ? "" : "s"} rejected after the deadline`)
  const otherSignals = [...counts.entries()]
    .filter(([t]) => t !== "device_change" && t !== "late_save_rejected")
    .reduce((s, [, n]) => s + n, 0)
  if (otherSignals) parts.push(`${otherSignals} browser signal${otherSignals === 1 ? "" : "s"} for review`)

  return {
    outageSec,
    backgroundSec,
    gaps,
    signals: [...counts.entries()].map(([type, count]) => ({ type, label: SIGNAL_LABEL[type] ?? type, count })),
    deviceChanges,
    lateSaves,
    extensions: ext.map((x) => ({ seconds: x.seconds, reason: x.reason, at: x.at.toISOString(), incident: !!x.incidentId })),
    summary: parts.length ? parts.join(", ") + "." : "Nothing recorded: an uninterrupted attempt.",
  }
}
