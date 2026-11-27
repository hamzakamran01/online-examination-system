import "server-only"
import { randomInt } from "node:crypto"
import { and, asc, desc, eq, inArray, lte, sql } from "drizzle-orm"
import { db, type Tx } from "@/server/db/client"
import {
  announcements,
  answers,
  attemptEvents,
  attempts,
  enrollments,
  examQuestions,
  exams,
  questionOptions,
  questions,
  topics,
} from "@/server/db/schema"
import type { SessionUser } from "@/server/auth/guards"
import { AppError, notFound } from "@/server/errors"
import { scoreItem } from "@/server/domain/grading"
import { effectiveStatus } from "@/lib/domain/exam-status"
import type { AnswerKey, AnswerResponse, Paper, PaperItem } from "@/lib/domain/paper"
import { saveAnswersSchema, type SaveAnswersInput } from "@/lib/validation/attempts"
import { round2 } from "@/lib/format"
import { getManagedExam } from "./exams"
import { audit } from "./audit"

type AttemptRow = typeof attempts.$inferSelect

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(i + 1)
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/* ----------------------------------------------------------------------------
 * Paper freezing (C-3.3.3, invariant 2)
 * ------------------------------------------------------------------------- */
async function buildPaper(tx: Tx, exam: typeof exams.$inferSelect) {
  const rows = await tx
    .select({
      id: questions.id,
      type: questions.type,
      stem: questions.stem,
      scheme: questions.multiScheme,
      rubric: questions.rubric,
      difficulty: questions.difficulty,
      topic: topics.name,
      marks: examQuestions.marks,
    })
    .from(examQuestions)
    .innerJoin(questions, eq(questions.id, examQuestions.questionId))
    .leftJoin(topics, eq(topics.id, questions.topicId))
    .where(eq(examQuestions.examId, exam.id))
    .orderBy(asc(examQuestions.position))
  if (!rows.length) throw new AppError("CONFLICT", "This exam has no questions yet.")

  const opts = await tx
    .select({ id: questionOptions.id, questionId: questionOptions.questionId, text: questionOptions.text, isCorrect: questionOptions.isCorrect })
    .from(questionOptions)
    .where(inArray(questionOptions.questionId, rows.map((r) => r.id)))
    .orderBy(asc(questionOptions.position))

  const key: AnswerKey = {}
  const items: PaperItem[] = rows.map((r) => {
    const own = opts.filter((o) => o.questionId === r.id)
    key[r.id] = { correct: own.filter((o) => o.isCorrect).map((o) => o.id), rubric: r.rubric }
    const ordered = exam.shuffleOptions && r.type !== "written" ? shuffle(own) : own
    return {
      itemId: r.id,
      type: r.type,
      stem: r.stem,
      marks: r.marks,
      scheme: r.scheme,
      topic: r.topic,
      difficulty: r.difficulty,
      options: ordered.map((o) => ({ id: o.id, text: o.text })),
    }
  })
  const paper: Paper = { items: exam.shuffleQuestions ? shuffle(items) : items }
  const maxMarks = round2(items.reduce((s, i) => s + i.marks, 0))
  return { paper, key, maxMarks }
}

/* ----------------------------------------------------------------------------
 * Candidate access rules (C-3.4.3)
 * ------------------------------------------------------------------------- */
export type AccessState =
  | { kind: "upcoming"; opensAt: Date }
  | { kind: "open" }
  | { kind: "resume"; attemptId: string }
  | { kind: "submitted"; attemptId: string }
  | { kind: "closed" }

export function candidateAccess(
  exam: { status: "draft" | "published" | "completed"; startsAt: Date; endsAt: Date },
  attempt: { id: string; status: AttemptRow["status"]; deadlineAt: Date } | null,
  now = new Date()
): AccessState {
  if (attempt && attempt.status !== "in_progress") return { kind: "submitted", attemptId: attempt.id }
  if (attempt && attempt.deadlineAt > now) return { kind: "resume", attemptId: attempt.id }
  if (attempt) return { kind: "submitted", attemptId: attempt.id } // expired, finalized lazily
  const s = effectiveStatus(exam, now)
  if (s === "published") return { kind: "upcoming", opensAt: exam.startsAt }
  if (s === "ongoing") return { kind: "open" }
  return { kind: "closed" }
}

/* ----------------------------------------------------------------------------
 * Grading state (C-3.7.3, invariant 10)
 * ------------------------------------------------------------------------- */
/** Recomputes the attempt totals from answer rows. Call inside the same transaction as any mark change. */
export async function recalcAttempt(tx: Tx, attempt: Pick<AttemptRow, "id" | "paper">) {
  const rows = await tx
    .select({ itemId: answers.itemId, autoScore: answers.autoScore, manualScore: answers.manualScore })
    .from(answers)
    .where(eq(answers.attemptId, attempt.id))
  const byItem = new Map(rows.map((r) => [r.itemId, r]))
  let auto = 0
  let manual = 0
  let pending = 0
  for (const item of attempt.paper.items) {
    const r = byItem.get(item.itemId)
    if (item.type === "written") {
      if (r?.manualScore === null || r?.manualScore === undefined) {
        // Blank written answers need no human: they score 0 automatically.
        if (r) pending++
      } else manual += r.manualScore
    } else auto += r?.autoScore ?? 0
  }
  const scoreAuto = round2(auto)
  const scoreManual = round2(manual)
  await tx
    .update(attempts)
    .set({
      scoreAuto,
      scoreManual,
      scoreTotal: round2(scoreAuto + scoreManual),
      gradingStatus: pending > 0 ? "pending" : "graded",
    })
    .where(eq(attempts.id, attempt.id))
}

/** Finalizes a locked in-progress attempt exactly once (invariant 4). */
async function finalizeLocked(tx: Tx, a: AttemptRow, reason: "candidate" | "timeout" | "examiner", now: Date) {
  if (a.status !== "in_progress") return false
  const rows = await tx
    .select({ itemId: answers.itemId, response: answers.response })
    .from(answers)
    .where(eq(answers.attemptId, a.id))
  const byItem = new Map(rows.map((r) => [r.itemId, r.response]))

  for (const item of a.paper.items) {
    const response = byItem.get(item.itemId)
    if (item.type === "written") {
      const blank = !(response?.kind === "text" && response.text.trim())
      if (blank && byItem.has(item.itemId))
        await tx.update(answers).set({ manualScore: 0 }).where(and(eq(answers.attemptId, a.id), eq(answers.itemId, item.itemId)))
      continue
    }
    const score = scoreItem(item, a.answerKey[item.itemId], response)
    if (byItem.has(item.itemId))
      await tx.update(answers).set({ autoScore: score }).where(and(eq(answers.attemptId, a.id), eq(answers.itemId, item.itemId)))
  }

  const submittedAt = reason === "timeout" && a.deadlineAt < now ? a.deadlineAt : now
  await tx
    .update(attempts)
    .set({ status: reason === "candidate" ? "submitted" : "auto_submitted", submitReason: reason, submittedAt })
    .where(eq(attempts.id, a.id))
  await recalcAttempt(tx, a)
  await tx.insert(attemptEvents).values({
    attemptId: a.id,
    type: reason === "candidate" ? "submitted" : "auto_submitted",
    source: "server",
    detail: { reason },
  })
  return true
}

/** Lazy expiry: finalize every expired in-progress attempt of an exam. Safe to call from any read. */
export async function finalizeExpiredForExam(examId: string) {
  const now = new Date()
  await db.transaction(async (tx) => {
    const expired = await tx
      .select()
      .from(attempts)
      .where(and(eq(attempts.examId, examId), eq(attempts.status, "in_progress"), lte(attempts.deadlineAt, now)))
      .for("update", { skipLocked: true })
    for (const a of expired) await finalizeLocked(tx, a, "timeout", now)
  })
}

/** Used by closeExam: finalizes all in-progress real attempts immediately. */
export async function finalizeAllForExam(tx: Tx, examId: string) {
  const now = new Date()
  const open = await tx
    .select()
    .from(attempts)
    .where(and(eq(attempts.examId, examId), eq(attempts.status, "in_progress"), eq(attempts.isSandbox, false)))
    .for("update")
  let n = 0
  for (const a of open) if (await finalizeLocked(tx, a, a.deadlineAt <= now ? "timeout" : "examiner", now)) n++
  return n
}

/* ----------------------------------------------------------------------------
 * Start (C-3.4.3, C-3.3.3, S-4.3)
 * ------------------------------------------------------------------------- */
export async function startAttempt(actor: SessionUser, examId: string, opts: { sandbox?: boolean } = {}) {
  const now = new Date()

  if (opts.sandbox) {
    if (actor.role !== "examiner") throw new AppError("FORBIDDEN", "Only the exam owner can preview it.")
    return db.transaction(async (tx) => {
      const exam = await getManagedExam(actor, examId, { tx })
      const { paper, key, maxMarks } = await buildPaper(tx, exam)
      const [a] = await tx
        .insert(attempts)
        .values({
          examId,
          candidateId: actor.id,
          isSandbox: true,
          startedAt: now,
          deadlineAt: new Date(now.getTime() + exam.durationMin * 60_000),
          paper,
          answerKey: key,
          maxMarks,
        })
        .returning({ id: attempts.id })
      await tx.insert(attemptEvents).values({ attemptId: a.id, type: "started", source: "server", detail: { sandbox: true } })
      return { attemptId: a.id }
    })
  }

  if (actor.role !== "candidate") throw new AppError("FORBIDDEN", "Only candidates can take exams.")
  const [row] = await db
    .select({ exam: exams })
    .from(enrollments)
    .innerJoin(exams, eq(exams.id, enrollments.examId))
    .where(and(eq(enrollments.examId, examId), eq(enrollments.candidateId, actor.id)))
    .limit(1)
  if (!row || row.exam.status === "draft") throw notFound("Exam")
  const exam = row.exam

  const [existing] = await db
    .select({ id: attempts.id, status: attempts.status, deadlineAt: attempts.deadlineAt })
    .from(attempts)
    .where(and(eq(attempts.examId, examId), eq(attempts.candidateId, actor.id), eq(attempts.isSandbox, false)))
    .limit(1)
  const access = candidateAccess(exam, existing ?? null, now)
  if (access.kind === "resume") return { attemptId: access.attemptId }
  if (access.kind === "submitted") throw new AppError("CONFLICT", "You have already submitted this exam.")
  if (access.kind === "upcoming") throw new AppError("NOT_AVAILABLE", "This exam has not opened yet.")
  if (access.kind === "closed") throw new AppError("NOT_AVAILABLE", "This exam is closed.")

  try {
    return await db.transaction(async (tx) => {
      const { paper, key, maxMarks } = await buildPaper(tx, exam)
      // Deadline is fixed here, on the server, and capped by the window (invariant 1).
      const deadlineAt = new Date(Math.min(now.getTime() + exam.durationMin * 60_000, exam.endsAt.getTime()))
      const [a] = await tx
        .insert(attempts)
        .values({ examId, candidateId: actor.id, startedAt: now, deadlineAt, paper, answerKey: key, maxMarks, lastSeenAt: now })
        .returning({ id: attempts.id })
      await tx.insert(attemptEvents).values({ attemptId: a.id, type: "started", source: "server" })
      return { attemptId: a.id }
    })
  } catch (e) {
    // Double click or two tabs: the unique index guarantees one real attempt, so return it.
    if ((e as { code?: string; cause?: { code?: string } })?.code === "23505" || (e as { cause?: { code?: string } })?.cause?.code === "23505") {
      const [a] = await db
        .select({ id: attempts.id })
        .from(attempts)
        .where(and(eq(attempts.examId, examId), eq(attempts.candidateId, actor.id), eq(attempts.isSandbox, false)))
      if (a) return { attemptId: a.id }
    }
    throw e
  }
}

/* ----------------------------------------------------------------------------
 * Runtime (C-3.5, invariants 1, 3, 4)
 * ------------------------------------------------------------------------- */
async function lockOwnAttempt(tx: Tx, actor: SessionUser, attemptId: string) {
  const [a] = await tx.select().from(attempts).where(eq(attempts.id, attemptId)).for("update")
  // Ownership: the candidate (or the examiner who owns a sandbox attempt). Others get 404.
  if (!a || a.candidateId !== actor.id) throw notFound("Attempt")
  return a
}

export type AttemptView = {
  id: string
  examId: string
  examTitle: string
  instructions: string
  isSandbox: boolean
  status: AttemptRow["status"]
  startedAt: string
  deadlineAt: string
  serverNow: string
  maxMarks: number
  paper: Paper
  answers: Record<string, { response: AnswerResponse | null; flagged: boolean; seq: number }>
  scratchpad: string
  announcements: { id: string; body: string; createdAt: string }[]
}

/** Candidate-safe view. Never includes the answer key or scores (invariant 3). */
export async function getAttemptView(actor: SessionUser, attemptId: string): Promise<AttemptView> {
  const now = new Date()
  const a = await db.transaction(async (tx) => {
    const row = await lockOwnAttempt(tx, actor, attemptId)
    if (row.status === "in_progress" && row.deadlineAt <= now) {
      await finalizeLocked(tx, row, "timeout", now)
      return { ...row, status: "auto_submitted" as const }
    }
    return row
  })
  const [exam] = await db
    .select({ title: exams.title, instructions: exams.instructions })
    .from(exams)
    .where(eq(exams.id, a.examId))
  const ans = await db
    .select({ itemId: answers.itemId, response: answers.response, flagged: answers.flagged, seq: answers.clientSeq })
    .from(answers)
    .where(eq(answers.attemptId, a.id))
  const notes = await db
    .select({ id: announcements.id, body: announcements.body, createdAt: announcements.createdAt })
    .from(announcements)
    .where(eq(announcements.examId, a.examId))
    .orderBy(desc(announcements.createdAt))
    .limit(20)

  return {
    id: a.id,
    examId: a.examId,
    examTitle: exam?.title ?? "Exam",
    instructions: exam?.instructions ?? "",
    isSandbox: a.isSandbox,
    status: a.status,
    startedAt: a.startedAt.toISOString(),
    deadlineAt: a.deadlineAt.toISOString(),
    serverNow: new Date().toISOString(),
    maxMarks: a.maxMarks,
    paper: a.paper,
    answers: Object.fromEntries(ans.map((x) => [x.itemId, { response: x.response, flagged: x.flagged, seq: x.seq }])),
    scratchpad: a.scratchpad,
    announcements: notes.map((n) => ({ id: n.id, body: n.body, createdAt: n.createdAt.toISOString() })),
  }
}

function validateResponse(item: PaperItem, response: AnswerResponse | null) {
  if (response === null) return
  if (item.type === "written") {
    if (response.kind !== "text") throw new AppError("VALIDATION", "A written answer must be text.")
    return
  }
  if (response.kind !== "choice") throw new AppError("VALIDATION", "Choose from the listed options.")
  const allowed = new Set(item.options.map((o) => o.id))
  if (response.selected.some((id) => !allowed.has(id))) throw new AppError("VALIDATION", "An option does not belong to this question.")
  if (new Set(response.selected).size !== response.selected.length) throw new AppError("VALIDATION", "Duplicate option selected.")
  if (item.type === "single" && response.selected.length > 1) throw new AppError("VALIDATION", "Select only one option.")
}

/**
 * Autosave (C-3.5.2). Batched, idempotent and order-safe: a row only changes
 * when the incoming client sequence is newer than the stored one.
 */
export async function saveAnswers(actor: SessionUser, attemptId: string, raw: SaveAnswersInput) {
  const input = saveAnswersSchema.parse(raw)
  const now = new Date()
  const result = await db.transaction(async (tx) => {
    const a = await lockOwnAttempt(tx, actor, attemptId)
    if (a.status !== "in_progress") return { kind: "finalized" as const, status: a.status }
    if (a.deadlineAt <= now) {
      await tx.insert(attemptEvents).values({
        attemptId: a.id,
        type: "late_save_rejected",
        source: "server",
        detail: { items: input.answers.length, lateByMs: now.getTime() - a.deadlineAt.getTime() },
      })
      await finalizeLocked(tx, a, "timeout", now)
      return { kind: "deadline" as const }
    }

    const items = new Map(a.paper.items.map((i) => [i.itemId, i]))
    for (const ans of input.answers) {
      const item = items.get(ans.itemId)
      if (!item) throw new AppError("VALIDATION", "Answer does not belong to this paper.")
      validateResponse(item, ans.response)
    }

    await tx
      .insert(answers)
      .values(
        input.answers.map((x) => ({
          attemptId: a.id,
          itemId: x.itemId,
          response: x.response,
          flagged: x.flagged,
          clientSeq: x.seq,
          savedAt: now,
        }))
      )
      .onConflictDoUpdate({
        target: [answers.attemptId, answers.itemId],
        set: {
          response: sql`excluded.response`,
          flagged: sql`excluded.flagged`,
          clientSeq: sql`excluded.client_seq`,
          savedAt: sql`excluded.saved_at`,
        },
        setWhere: sql`${answers.clientSeq} < excluded.client_seq`,
      })

    if (a.lastClientId && a.lastClientId !== input.clientId)
      await tx.insert(attemptEvents).values({ attemptId: a.id, type: "device_change", source: "server", detail: { note: "Saving from a different browser or device" } })
    await tx.update(attempts).set({ lastSeenAt: now, lastClientId: input.clientId }).where(eq(attempts.id, a.id))
    return { kind: "ok" as const, deadlineAt: a.deadlineAt }
  })

  if (result.kind === "finalized") throw new AppError("CONFLICT", "This attempt has already been submitted.")
  if (result.kind === "deadline") throw new AppError("DEADLINE_PASSED", "Time is up. Answers sent after the deadline cannot be accepted.")
  return {
    acked: input.answers.map((x) => ({ itemId: x.itemId, seq: x.seq })),
    serverNow: new Date().toISOString(),
    deadlineAt: result.deadlineAt.toISOString(),
  }
}

/** Submit (C-3.5.3, T-6.2b). Repeated calls return the same finalized state. */
export async function submitAttempt(actor: SessionUser, attemptId: string) {
  const now = new Date()
  return db.transaction(async (tx) => {
    const a = await lockOwnAttempt(tx, actor, attemptId)
    if (a.status !== "in_progress") return { status: a.status, alreadySubmitted: true }
    const reason = a.deadlineAt <= now ? "timeout" : "candidate"
    await finalizeLocked(tx, a, reason, now)
    if (!a.isSandbox) await audit(tx, actor.id, "attempt.submitted", "attempt", a.id, { reason })
    return { status: reason === "candidate" ? ("submitted" as const) : ("auto_submitted" as const), alreadySubmitted: false }
  })
}

/** Light status read for heartbeats and done pages. */
export async function getAttemptStatus(actor: SessionUser, attemptId: string) {
  const [a] = await db
    .select({ id: attempts.id, candidateId: attempts.candidateId, status: attempts.status, deadlineAt: attempts.deadlineAt, examId: attempts.examId, isSandbox: attempts.isSandbox, submittedAt: attempts.submittedAt })
    .from(attempts)
    .where(eq(attempts.id, attemptId))
  if (!a || a.candidateId !== actor.id) throw notFound("Attempt")
  if (a.status === "in_progress" && a.deadlineAt <= new Date()) {
    await finalizeExpiredForExam(a.examId)
    return getAttemptStatus(actor, attemptId)
  }
  return a
}

/* ----------------------------------------------------------------------------
 * Candidate dashboard (C-3.4.2)
 * ------------------------------------------------------------------------- */
export async function listCandidateExams(actor: SessionUser) {
  if (actor.role !== "candidate") throw new AppError("FORBIDDEN", "Only candidates have assigned exams.")
  const now = new Date()
  // Finalize this candidate's expired attempts first so the grouping is accurate.
  const stale = await db
    .select({ examId: attempts.examId })
    .from(attempts)
    .where(and(eq(attempts.candidateId, actor.id), eq(attempts.status, "in_progress"), lte(attempts.deadlineAt, now)))
  for (const s of stale) await finalizeExpiredForExam(s.examId)

  const rows = await db
    .select({
      exam: {
        id: exams.id,
        title: exams.title,
        instructions: exams.instructions,
        status: exams.status,
        startsAt: exams.startsAt,
        endsAt: exams.endsAt,
        durationMin: exams.durationMin,
        totalMarks: exams.totalMarks,
        resultsPublishedAt: exams.resultsPublishedAt,
      },
      attempt: { id: attempts.id, status: attempts.status, deadlineAt: attempts.deadlineAt, submittedAt: attempts.submittedAt },
      questionCount: sql<number>`(select count(*)::int from ${examQuestions} where ${examQuestions.examId} = ${exams.id})`,
    })
    .from(enrollments)
    .innerJoin(exams, eq(exams.id, enrollments.examId))
    .leftJoin(attempts, and(eq(attempts.examId, exams.id), eq(attempts.candidateId, actor.id), eq(attempts.isSandbox, false)))
    .where(and(eq(enrollments.candidateId, actor.id), sql`${exams.status} <> 'draft'`))
    .orderBy(asc(exams.startsAt))

  return rows.map((r) => {
    const attempt = r.attempt?.id ? r.attempt : null
    return { ...r.exam, questionCount: r.questionCount, attempt, access: candidateAccess(r.exam, attempt, now) }
  })
}

export async function getCandidateLobby(actor: SessionUser, examId: string) {
  const list = await listCandidateExams(actor)
  const exam = list.find((e) => e.id === examId)
  if (!exam) throw notFound("Exam")
  return exam
}

export async function listSandboxAttempts(actor: SessionUser, examId: string) {
  await getManagedExam(actor, examId)
  return db
    .select({ id: attempts.id, status: attempts.status, startedAt: attempts.startedAt, scoreTotal: attempts.scoreTotal, maxMarks: attempts.maxMarks })
    .from(attempts)
    .where(and(eq(attempts.examId, examId), eq(attempts.isSandbox, true), eq(attempts.candidateId, actor.id)))
    .orderBy(desc(attempts.startedAt))
    .limit(5)
}

