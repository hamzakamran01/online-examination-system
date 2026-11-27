import "server-only"
import { and, asc, eq, ilike, inArray, or, sql } from "drizzle-orm"
import { db } from "@/server/db/client"
import { attempts, enrollments, user } from "@/server/db/schema"
import type { SessionUser } from "@/server/auth/guards"
import { AppError } from "@/server/errors"
import { audit } from "./audit"
import { getManagedExam } from "./exams"
import { enrollSchema } from "@/lib/validation/exams"
import { effectiveStatus } from "@/lib/domain/exam-status"

/** Enrollment table with each candidate's real attempt state (C-3.4.1). */
export async function listEnrollments(actor: SessionUser, examId: string) {
  await getManagedExam(actor, examId)
  return db
    .select({
      candidateId: user.id,
      name: user.name,
      email: user.email,
      active: user.active,
      enrolledAt: enrollments.createdAt,
      attemptId: attempts.id,
      attemptStatus: attempts.status,
      startedAt: attempts.startedAt,
      submittedAt: attempts.submittedAt,
      deadlineAt: attempts.deadlineAt,
      scoreTotal: attempts.scoreTotal,
      gradingStatus: attempts.gradingStatus,
    })
    .from(enrollments)
    .innerJoin(user, eq(user.id, enrollments.candidateId))
    .leftJoin(
      attempts,
      and(eq(attempts.examId, enrollments.examId), eq(attempts.candidateId, enrollments.candidateId), eq(attempts.isSandbox, false))
    )
    .where(eq(enrollments.examId, examId))
    .orderBy(asc(user.name))
}

/** Candidate directory for enrollment pickers (name and email only). */
export async function searchCandidates(actor: SessionUser, examId: string, q: string) {
  await getManagedExam(actor, examId)
  const term = q.trim()
  return db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      enrolled: sql<boolean>`exists(select 1 from ${enrollments} where ${enrollments.examId} = ${examId} and ${enrollments.candidateId} = ${user.id})`,
    })
    .from(user)
    .where(
      and(
        eq(user.role, "candidate"),
        eq(user.active, true),
        term ? or(ilike(user.name, `%${term}%`), ilike(user.email, `%${term}%`)) : undefined
      )
    )
    .orderBy(asc(user.name))
    .limit(50)
}

export async function enrollCandidates(actor: SessionUser, raw: { examId: string; candidateIds: string[] }) {
  const input = enrollSchema.parse(raw)
  return db.transaction(async (tx) => {
    const exam = await getManagedExam(actor, input.examId, { write: true, tx })
    if (effectiveStatus(exam) === "completed") throw new AppError("CONFLICT", "This exam has ended. Enrollment is closed.")
    const valid = await tx
      .select({ id: user.id })
      .from(user)
      .where(and(inArray(user.id, input.candidateIds), eq(user.role, "candidate"), eq(user.active, true)))
    if (valid.length !== input.candidateIds.length)
      throw new AppError("VALIDATION", "Only active candidate accounts can be enrolled.")
    const inserted = await tx
      .insert(enrollments)
      .values(valid.map((v) => ({ examId: exam.id, candidateId: v.id, enrolledBy: actor.id })))
      .onConflictDoNothing()
      .returning({ id: enrollments.candidateId })
    await audit(tx, actor.id, "enrollment.added", "exam", exam.id, { count: inserted.length })
    return { added: inserted.length, skipped: valid.length - inserted.length }
  })
}

export async function unenrollCandidate(actor: SessionUser, examId: string, candidateId: string) {
  await db.transaction(async (tx) => {
    const exam = await getManagedExam(actor, examId, { write: true, tx })
    const [started] = await tx
      .select({ id: attempts.id })
      .from(attempts)
      .where(and(eq(attempts.examId, exam.id), eq(attempts.candidateId, candidateId), eq(attempts.isSandbox, false)))
      .limit(1)
    if (started) throw new AppError("CONFLICT", "This candidate has already started the exam, so the record must be kept.")
    const removed = await tx
      .delete(enrollments)
      .where(and(eq(enrollments.examId, exam.id), eq(enrollments.candidateId, candidateId)))
      .returning({ id: enrollments.candidateId })
    if (!removed.length) throw new AppError("NOT_FOUND", "This candidate is not enrolled.")
    await audit(tx, actor.id, "enrollment.removed", "exam", exam.id, { candidateId })
  })
}
