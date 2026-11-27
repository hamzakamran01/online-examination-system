import "server-only"
import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm"
import { db, type Tx } from "@/server/db/client"
import { attempts, enrollments, examQuestions, exams, questions, topics } from "@/server/db/schema"
import type { SessionUser } from "@/server/auth/guards"
import { AppError, notFound } from "@/server/errors"
import { audit } from "./audit"
import { effectiveStatus } from "@/lib/domain/exam-status"
import { examQuestionsSchema, examSchema, type ExamInput, type ExamQuestionsInput } from "@/lib/validation/exams"
import { round2 } from "@/lib/format"

export type ExamRow = typeof exams.$inferSelect

/**
 * Loads an exam the actor may manage. Examiners: own exams only. Admins: read
 * access to all (writes still require ownership). Foreign ids look like 404.
 */
export async function getManagedExam(actor: SessionUser, examId: string, opts: { write?: boolean; tx?: Tx } = {}) {
  if (actor.role === "candidate") throw notFound("Exam")
  const q = (opts.tx ?? db).select().from(exams).where(eq(exams.id, examId))
  const [exam] = opts.tx && opts.write ? await q.for("update") : await q
  if (!exam) throw notFound("Exam")
  const owns = exam.ownerId === actor.id
  if (!owns && !(actor.role === "admin" && !opts.write)) throw notFound("Exam")
  return exam
}

export async function listManagedExams(actor: SessionUser) {
  if (actor.role === "candidate") throw new AppError("FORBIDDEN", "Not allowed.")
  const rows = await db
    .select({
      id: exams.id,
      title: exams.title,
      status: exams.status,
      startsAt: exams.startsAt,
      endsAt: exams.endsAt,
      durationMin: exams.durationMin,
      totalMarks: exams.totalMarks,
      resultsPublishedAt: exams.resultsPublishedAt,
      updatedAt: exams.updatedAt,
      // Correlated subqueries use explicit aliases: with a single-table outer query Drizzle renders
      // columns unqualified, and a bare "id" would bind to the inner table instead of exams.
      questionCount: sql<number>`(select count(*)::int from exam_questions eq where eq.exam_id = "exams"."id")`,
      enrolledCount: sql<number>`(select count(*)::int from enrollments en where en.exam_id = "exams"."id")`,
      activeCount: sql<number>`(select count(*)::int from attempts a where a.exam_id = "exams"."id" and a.is_sandbox = false and a.status = 'in_progress' and a.deadline_at > now())`,
      submittedCount: sql<number>`(select count(*)::int from attempts a where a.exam_id = "exams"."id" and a.is_sandbox = false and a.status <> 'in_progress')`,
      toGradeCount: sql<number>`(select count(*)::int from attempts a where a.exam_id = "exams"."id" and a.is_sandbox = false and a.status <> 'in_progress' and a.grading_status = 'pending')`,
    })
    .from(exams)
    .where(actor.role === "admin" ? undefined : eq(exams.ownerId, actor.id))
    .orderBy(desc(exams.startsAt))
  const now = new Date()
  return rows.map((r) => {
    const effective = effectiveStatus(r, now)
    // Board stage: the examiner's next job, derived from lifecycle plus grading state.
    const stage =
      effective === "draft"
        ? ("draft" as const)
        : effective === "published"
          ? ("scheduled" as const)
          : effective === "ongoing"
            ? ("live" as const)
            : r.resultsPublishedAt
              ? ("released" as const)
              : ("grading" as const)
    return { ...r, effective, stage, windowProgress: Math.min(1, Math.max(0, (now.getTime() - r.startsAt.getTime()) / (r.endsAt.getTime() - r.startsAt.getTime()))) }
  })
}

function toValues(input: ReturnType<typeof examSchema.parse>) {
  return {
    title: input.title,
    instructions: input.instructions,
    startsAt: new Date(input.startsAt),
    endsAt: new Date(input.endsAt),
    durationMin: input.durationMin,
    totalMarks: input.totalMarks,
    passMark: input.passMark,
    shuffleQuestions: input.shuffleQuestions,
    shuffleOptions: input.shuffleOptions,
    releaseAnswerReview: input.releaseAnswerReview,
  }
}

export async function createExam(actor: SessionUser, raw: ExamInput) {
  if (actor.role !== "examiner") throw new AppError("FORBIDDEN", "Only examiners can create exams.")
  const input = examSchema.parse(raw)
  return db.transaction(async (tx) => {
    const [created] = await tx
      .insert(exams)
      .values({ ...toValues(input), ownerId: actor.id, status: "draft" })
      .returning({ id: exams.id })
    await audit(tx, actor.id, "exam.created", "exam", created.id, { title: input.title })
    return { id: created.id }
  })
}

export async function updateExam(actor: SessionUser, raw: ExamInput) {
  const input = examSchema.parse(raw)
  if (!input.id) throw new AppError("VALIDATION", "Missing exam id.")
  return db.transaction(async (tx) => {
    const exam = await getManagedExam(actor, input.id!, { write: true, tx })
    if (exam.status !== "draft")
      throw new AppError("CONFLICT", "Only draft exams can be edited. Move it back to draft first (possible until a candidate starts).")
    await tx.update(exams).set(toValues(input)).where(eq(exams.id, exam.id))
    await audit(tx, actor.id, "exam.updated", "exam", exam.id)
    return { id: exam.id }
  })
}

export async function getExamQuestions(actor: SessionUser, examId: string) {
  await getManagedExam(actor, examId)
  return db
    .select({
      questionId: examQuestions.questionId,
      position: examQuestions.position,
      marks: examQuestions.marks,
      stem: questions.stem,
      type: questions.type,
      difficulty: questions.difficulty,
      topicName: topics.name,
      archived: sql<boolean>`${questions.archivedAt} is not null`,
    })
    .from(examQuestions)
    .innerJoin(questions, eq(questions.id, examQuestions.questionId))
    .leftJoin(topics, eq(topics.id, questions.topicId))
    .where(eq(examQuestions.examId, examId))
    .orderBy(asc(examQuestions.position))
}

/** Replaces the exam's question list atomically (draft only). */
export async function setExamQuestions(actor: SessionUser, raw: ExamQuestionsInput) {
  const input = examQuestionsSchema.parse(raw)
  return db.transaction(async (tx) => {
    const exam = await getManagedExam(actor, input.examId, { write: true, tx })
    if (exam.status !== "draft") throw new AppError("CONFLICT", "Questions can only be changed while the exam is a draft.")
    const ids = input.items.map((i) => i.questionId)
    if (ids.length) {
      const owned = await tx
        .select({ id: questions.id })
        .from(questions)
        .where(and(inArray(questions.id, ids), eq(questions.ownerId, actor.id), isNull(questions.archivedAt)))
      if (owned.length !== ids.length) throw new AppError("VALIDATION", "Some questions are no longer available in your bank.")
    }
    await tx.delete(examQuestions).where(eq(examQuestions.examId, exam.id))
    if (input.items.length)
      await tx
        .insert(examQuestions)
        .values(input.items.map((i, position) => ({ examId: exam.id, questionId: i.questionId, marks: i.marks, position })))
    await audit(tx, actor.id, "exam.questions_set", "exam", exam.id, { count: input.items.length })
    return { count: input.items.length }
  })
}

export type ReadinessCheck = { id: string; label: string; ok: boolean; detail: string; blocking: boolean }

/** Pre-publication review (C-3.2.3). Blocking checks must pass before publishing. */
export async function getReadiness(actor: SessionUser, examId: string) {
  const exam = await getManagedExam(actor, examId)
  const items = await getExamQuestions(actor, examId)
  const [{ enrolled }] = await db
    .select({ enrolled: sql<number>`count(*)::int` })
    .from(enrollments)
    .where(eq(enrollments.examId, examId))
  const sum = round2(items.reduce((s, i) => s + i.marks, 0))
  const now = Date.now()
  const types = new Set(items.map((i) => i.type))
  const checks: ReadinessCheck[] = [
    { id: "questions", label: "Questions assigned", ok: items.length > 0, detail: `${items.length} question${items.length === 1 ? "" : "s"}`, blocking: true },
    { id: "marks", label: "Marks add up", ok: items.length > 0 && sum === exam.totalMarks, detail: `Questions total ${sum} of ${exam.totalMarks} configured marks`, blocking: true },
    { id: "archived", label: "No archived questions", ok: !items.some((i) => i.archived), detail: items.some((i) => i.archived) ? "Replace archived questions" : "All questions are active", blocking: true },
    { id: "window", label: "Window is in the future", ok: exam.endsAt.getTime() > now, detail: exam.endsAt.getTime() > now ? "Candidates can still take it" : "The window has already ended", blocking: true },
    { id: "duration", label: "Duration fits the window", ok: exam.durationMin * 60_000 <= exam.endsAt.getTime() - exam.startsAt.getTime(), detail: `${exam.durationMin} min`, blocking: true },
    { id: "candidates", label: "Candidates enrolled", ok: enrolled > 0, detail: enrolled ? `${enrolled} enrolled` : "You can also enroll after publishing", blocking: false },
    { id: "instructions", label: "Instructions written", ok: exam.instructions.trim().length > 0, detail: exam.instructions.trim() ? "Shown in the exam lobby" : "Recommended for candidates", blocking: false },
    { id: "written", label: "Manual grading needed", ok: true, detail: types.has("written") ? "Contains written questions: results need manual grading" : "Fully auto-graded", blocking: false },
  ]
  return { exam, items, enrolled, sum, checks, ready: checks.every((c) => c.ok || !c.blocking) }
}

export async function publishExam(actor: SessionUser, examId: string) {
  const r = await getReadiness(actor, examId)
  if (!r.ready) throw new AppError("CONFLICT", "Resolve the blocking checks before publishing.")
  await db.transaction(async (tx) => {
    const exam = await getManagedExam(actor, examId, { write: true, tx })
    if (exam.status !== "draft") throw new AppError("CONFLICT", "This exam is already published.")
    await tx.update(exams).set({ status: "published", publishedAt: new Date() }).where(eq(exams.id, examId))
    await audit(tx, actor.id, "exam.published", "exam", examId)
  })
}

export async function unpublishExam(actor: SessionUser, examId: string) {
  await db.transaction(async (tx) => {
    const exam = await getManagedExam(actor, examId, { write: true, tx })
    if (exam.status !== "published") throw new AppError("CONFLICT", "Only a published exam can move back to draft.")
    const [{ n }] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(attempts)
      .where(and(eq(attempts.examId, examId), eq(attempts.isSandbox, false)))
    if (n > 0) throw new AppError("CONFLICT", "Candidates have already started this exam, so it cannot return to draft.")
    await tx.update(exams).set({ status: "draft", publishedAt: null }).where(eq(exams.id, examId))
    await audit(tx, actor.id, "exam.unpublished", "exam", examId)
  })
}

/** Ends the exam now. In-progress attempts are finalized by the attempts service. */
export async function closeExam(actor: SessionUser, examId: string, finalize: (tx: Tx, examId: string) => Promise<number>) {
  return db.transaction(async (tx) => {
    const exam = await getManagedExam(actor, examId, { write: true, tx })
    if (exam.status !== "published") throw new AppError("CONFLICT", "Only a published exam can be closed.")
    const now = new Date()
    await tx.update(exams).set({ status: "completed", closedAt: now }).where(eq(exams.id, examId))
    const finalized = await finalize(tx, examId)
    await audit(tx, actor.id, "exam.closed", "exam", examId, { finalizedAttempts: finalized })
    return { finalized }
  })
}

export async function deleteDraftExam(actor: SessionUser, examId: string) {
  await db.transaction(async (tx) => {
    const exam = await getManagedExam(actor, examId, { write: true, tx })
    // Drafts can only hold sandbox attempts (never real ones), which cascade away.
    if (exam.status !== "draft") throw new AppError("CONFLICT", "Only drafts can be deleted.")
    await tx.delete(exams).where(eq(exams.id, examId))
    await audit(tx, actor.id, "exam.deleted", "exam", examId, { title: exam.title })
  })
}
