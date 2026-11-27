import "server-only"
import { and, asc, desc, eq, inArray, ne, sql } from "drizzle-orm"
import { db } from "@/server/db/client"
import { answers, attempts, auditLog, exams, user } from "@/server/db/schema"
import type { SessionUser } from "@/server/auth/guards"
import { AppError, notFound } from "@/server/errors"
import { effectiveStatus } from "@/lib/domain/exam-status"
import type { AnswerResponse, PaperItem } from "@/lib/domain/paper"
import { gradeAnswerSchema, type GradeAnswerInput } from "@/lib/validation/grading"
import { round2 } from "@/lib/format"
import { getManagedExam } from "./exams"
import { finalizeExpiredForExam, recalcAttempt } from "./attempts"
import { audit } from "./audit"


const answerKeyId = (attemptId: string, itemId: string) => `${attemptId}:${itemId}`

/* ----------------------------------------------------------------------------
 * Examiner: results overview and grading queue (C-3.7.2, C-3.7.3, C-3.8.1)
 * ------------------------------------------------------------------------- */
export async function getResultsOverview(actor: SessionUser, examId: string) {
  const exam = await getManagedExam(actor, examId)
  await finalizeExpiredForExam(exam.id)
  const rows = await db
    .select({
      id: attempts.id,
      candidate: user.name,
      email: user.email,
      status: attempts.status,
      submittedAt: attempts.submittedAt,
      submitReason: attempts.submitReason,
      scoreAuto: attempts.scoreAuto,
      scoreManual: attempts.scoreManual,
      scoreTotal: attempts.scoreTotal,
      maxMarks: attempts.maxMarks,
      gradingStatus: attempts.gradingStatus,
      paper: attempts.paper,
    })
    .from(attempts)
    .innerJoin(user, eq(user.id, attempts.candidateId))
    .where(and(eq(attempts.examId, exam.id), eq(attempts.isSandbox, false)))
    .orderBy(asc(user.name))

  const pendingByAttempt = new Map<string, number>()
  const finalIds = rows.filter((r) => r.status !== "in_progress").map((r) => r.id)
  if (finalIds.length) {
    const pending = await db
      .select({ attemptId: answers.attemptId, n: sql<number>`count(*)::int` })
      .from(answers)
      .where(and(inArray(answers.attemptId, finalIds), sql`${answers.manualScore} is null`, sql`${answers.autoScore} is null`))
      .groupBy(answers.attemptId)
    for (const p of pending) pendingByAttempt.set(p.attemptId, p.n)
  }

  const list = rows.map(({ paper, ...r }) => ({
    ...r,
    writtenCount: paper.items.filter((i) => i.type === "written").length,
    pendingCount: r.status === "in_progress" ? 0 : (pendingByAttempt.get(r.id) ?? 0),
  }))
  const inProgress = list.filter((r) => r.status === "in_progress").length
  const finalized = list.filter((r) => r.status !== "in_progress")
  const ungraded = finalized.filter((r) => r.gradingStatus === "pending").length
  const status = effectiveStatus(exam)

  const blockers: string[] = []
  if (status !== "completed") blockers.push("The exam window is still open. Close the exam or wait until it ends.")
  if (inProgress) blockers.push(`${inProgress} candidate${inProgress === 1 ? " is" : "s are"} still writing.`)
  if (ungraded) blockers.push(`${ungraded} attempt${ungraded === 1 ? " has" : "s have"} written answers to grade.`)
  if (!finalized.length) blockers.push("No submitted attempts yet.")

  return {
    exam,
    status,
    attempts: list,
    summary: { finalized: finalized.length, inProgress, ungraded, graded: finalized.length - ungraded },
    canPublish: !exam.resultsPublishedAt && blockers.length === 0,
    blockers,
  }
}

export type GradingItem = {
  item: PaperItem
  index: number
  response: AnswerResponse | null
  correct: string[]
  rubric: string | null
  autoScore: number | null
  manualScore: number | null
  feedback: string | null
  needsGrading: boolean
  history: { at: string; by: string | null; from: number | null; to: number; reason: string | null }[]
}

/** Full attempt for the grader, including the frozen answer key and rubric (examiner only). */
export async function getGradingAttempt(actor: SessionUser, examId: string, attemptId: string) {
  const exam = await getManagedExam(actor, examId)
  const [a] = await db
    .select({ attempt: attempts, candidate: user.name, email: user.email })
    .from(attempts)
    .innerJoin(user, eq(user.id, attempts.candidateId))
    .where(and(eq(attempts.id, attemptId), eq(attempts.examId, exam.id), eq(attempts.isSandbox, false)))
  if (!a) throw notFound("Attempt")
  const rows = await db.select().from(answers).where(eq(answers.attemptId, attemptId))
  const byItem = new Map(rows.map((r) => [r.itemId, r]))
  const history = await db
    .select({ entityId: auditLog.entityId, meta: auditLog.meta, createdAt: auditLog.createdAt, by: user.name })
    .from(auditLog)
    .leftJoin(user, eq(user.id, auditLog.actorId))
    .where(and(eq(auditLog.entityType, "answer"), sql`${auditLog.entityId} like ${attemptId + ":%"}`))
    .orderBy(desc(auditLog.createdAt))

  const items: GradingItem[] = a.attempt.paper.items.map((item, index) => {
    const r = byItem.get(item.itemId)
    const response = r?.response ?? null
    const written = item.type === "written"
    return {
      item,
      index,
      response,
      correct: a.attempt.answerKey[item.itemId]?.correct ?? [],
      rubric: a.attempt.answerKey[item.itemId]?.rubric ?? null,
      autoScore: r?.autoScore ?? null,
      manualScore: r?.manualScore ?? null,
      feedback: r?.feedback ?? null,
      needsGrading: written && a.attempt.status !== "in_progress" && !!r && r.manualScore === null,
      history: history
        .filter((h) => h.entityId === answerKeyId(attemptId, item.itemId))
        .map((h) => ({
          at: h.createdAt.toISOString(),
          by: h.by,
          from: (h.meta.from as number | null) ?? null,
          to: h.meta.to as number,
          reason: (h.meta.reason as string | null) ?? null,
        })),
    }
  })

  const [neighbours] = await db
    .select({
      next: sql<string | null>`(select a2.id from ${attempts} a2 where a2.exam_id = ${exam.id} and a2.is_sandbox = false and a2.grading_status = 'pending' and a2.status <> 'in_progress' and a2.id <> ${attemptId} order by a2.submitted_at limit 1)`,
    })
    .from(exams)
    .where(eq(exams.id, exam.id))

  return {
    exam,
    attempt: {
      id: a.attempt.id,
      candidate: a.candidate,
      email: a.email,
      status: a.attempt.status,
      submittedAt: a.attempt.submittedAt,
      submitReason: a.attempt.submitReason,
      scoreAuto: a.attempt.scoreAuto,
      scoreManual: a.attempt.scoreManual,
      scoreTotal: a.attempt.scoreTotal,
      maxMarks: a.attempt.maxMarks,
      gradingStatus: a.attempt.gradingStatus,
    },
    items,
    nextUngradedId: neighbours?.next ?? null,
  }
}

/**
 * Manual grading of one written answer. Totals are recalculated in the same
 * transaction (invariant 10). After results are published, a reason is required
 * and the change is recorded as a regrade; old report codes are superseded by the
 * report service when the next PDF is issued.
 */
export async function gradeAnswer(actor: SessionUser, raw: GradeAnswerInput) {
  if (actor.role !== "examiner") throw new AppError("FORBIDDEN", "Only the exam owner can grade.")
  const input = gradeAnswerSchema.parse(raw)
  return db.transaction(async (tx) => {
    const [a] = await tx.select().from(attempts).where(eq(attempts.id, input.attemptId)).for("update")
    if (!a || a.isSandbox) throw notFound("Attempt")
    const exam = await getManagedExam(actor, a.examId, { write: true, tx })
    if (a.status === "in_progress") throw new AppError("CONFLICT", "This attempt is still in progress. Grade it after submission.")
    const item = a.paper.items.find((i) => i.itemId === input.itemId)
    if (!item) throw notFound("Question")
    if (item.type !== "written") throw new AppError("VALIDATION", "Objective questions are graded automatically from the marking scheme.")
    if (input.marks > item.marks)
      throw new AppError("VALIDATION", `Marks cannot exceed ${item.marks} for this question.`, { marks: `Maximum is ${item.marks}.` })
    const published = Boolean(exam.resultsPublishedAt)
    if (published && input.reason.length < 5)
      throw new AppError("VALIDATION", "Results are already published. Give a reason for this regrade.", { reason: "Explain why the mark changes." })

    const [existing] = await tx
      .select({ manualScore: answers.manualScore, feedback: answers.feedback })
      .from(answers)
      .where(and(eq(answers.attemptId, a.id), eq(answers.itemId, item.itemId)))
    const now = new Date()
    if (existing) {
      if (existing.manualScore === input.marks && (existing.feedback ?? "") === input.feedback) return { unchanged: true }
      await tx
        .update(answers)
        .set({ manualScore: input.marks, feedback: input.feedback || null, gradedBy: actor.id, gradedAt: now })
        .where(and(eq(answers.attemptId, a.id), eq(answers.itemId, item.itemId)))
    } else {
      // Unanswered written question: record the decision explicitly.
      await tx.insert(answers).values({
        attemptId: a.id,
        itemId: item.itemId,
        response: null,
        manualScore: input.marks,
        feedback: input.feedback || null,
        gradedBy: actor.id,
        gradedAt: now,
      })
    }
    await recalcAttempt(tx, a)
    await audit(tx, actor.id, published ? "grade.regraded" : "grade.set", "answer", answerKeyId(a.id, item.itemId), {
      examId: exam.id,
      from: existing?.manualScore ?? null,
      to: input.marks,
      max: item.marks,
      reason: input.reason || null,
    })
    const [after] = await tx
      .select({ scoreTotal: attempts.scoreTotal, gradingStatus: attempts.gradingStatus })
      .from(attempts)
      .where(eq(attempts.id, a.id))
    return { unchanged: false, ...after }
  })
}

export async function publishResults(actor: SessionUser, examId: string) {
  if (actor.role !== "examiner") throw new AppError("FORBIDDEN", "Only the exam owner can publish results.")
  const overview = await getResultsOverview(actor, examId)
  if (overview.exam.resultsPublishedAt) throw new AppError("CONFLICT", "Results are already published.")
  if (!overview.canPublish) throw new AppError("CONFLICT", overview.blockers[0] ?? "Results are not ready to publish.")
  await db.transaction(async (tx) => {
    const exam = await getManagedExam(actor, examId, { write: true, tx })
    // Re-check inside the transaction so a late grading change cannot slip past the gate.
    const [{ pending }] = await tx
      .select({ pending: sql<number>`count(*)::int` })
      .from(attempts)
      .where(
        and(
          eq(attempts.examId, exam.id),
          eq(attempts.isSandbox, false),
          sql`(${attempts.status} = 'in_progress' or ${attempts.gradingStatus} = 'pending')`
        )
      )
    if (pending) throw new AppError("CONFLICT", "Some attempts changed. Refresh and try again.")
    await tx.update(exams).set({ resultsPublishedAt: new Date() }).where(eq(exams.id, exam.id))
    await audit(tx, actor.id, "results.published", "exam", exam.id, { attempts: overview.summary.finalized })
  })
}

/* ----------------------------------------------------------------------------
 * Candidate: own result (C-3.8.1). Before publication only the candidate's own
 * submitted answers are shown: no marks, no keys, no feedback.
 * ------------------------------------------------------------------------- */
export async function getCandidateResult(actor: SessionUser, attemptId: string) {
  if (actor.role !== "candidate") throw notFound("Result")
  const [a] = await db
    .select({ attempt: attempts, exam: exams })
    .from(attempts)
    .innerJoin(exams, eq(exams.id, attempts.examId))
    .where(and(eq(attempts.id, attemptId), eq(attempts.candidateId, actor.id), eq(attempts.isSandbox, false), ne(attempts.status, "in_progress")))
  if (!a) throw notFound("Result")
  const rows = await db.select().from(answers).where(eq(answers.attemptId, attemptId))
  const byItem = new Map(rows.map((r) => [r.itemId, r]))
  const published = Boolean(a.exam.resultsPublishedAt)
  const reveal = published && a.exam.releaseAnswerReview

  const items = a.attempt.paper.items.map((item, index) => {
    const r = byItem.get(item.itemId)
    const base = {
      index,
      itemId: item.itemId,
      type: item.type,
      stem: item.stem,
      maxMarks: item.marks,
      options: item.options,
      response: r?.response ?? null,
    }
    if (!published) return { ...base, marks: null, feedback: null, correct: null }
    const marks = item.type === "written" ? (r?.manualScore ?? 0) : (r?.autoScore ?? 0)
    return { ...base, marks, feedback: r?.feedback ?? null, correct: reveal ? (a.attempt.answerKey[item.itemId]?.correct ?? []) : null }
  })

  const score = published ? (a.attempt.scoreTotal ?? 0) : null
  return {
    published,
    revealAnswers: reveal,
    exam: { id: a.exam.id, title: a.exam.title, totalMarks: a.exam.totalMarks, passMark: a.exam.passMark, publishedAt: a.exam.resultsPublishedAt },
    attempt: { id: a.attempt.id, submittedAt: a.attempt.submittedAt, submitReason: a.attempt.submitReason, maxMarks: a.attempt.maxMarks },
    score,
    percent: score === null || !a.attempt.maxMarks ? null : round2((100 * score) / a.attempt.maxMarks),
    passed: score === null || a.exam.passMark === null || a.exam.passMark <= 0 ? null : score >= a.exam.passMark,
    items,
  }
}


