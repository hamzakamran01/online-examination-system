"use server"

import { revalidatePath } from "next/cache"
import { requireRole } from "@/server/auth/guards"
import { runAction } from "@/server/errors"
import {
  closeExam,
  createExam,
  deleteDraftExam,
  publishExam,
  setExamQuestions,
  unpublishExam,
  updateExam,
} from "@/server/services/exams"
import { enrollCandidates, searchCandidates, unenrollCandidate } from "@/server/services/enrollments"
import { finalizeAllForExam, startAttempt } from "@/server/services/attempts"
import type { ExamInput, ExamQuestionsInput } from "@/lib/validation/exams"

const refresh = (examId?: string) => {
  revalidatePath("/examiner")
  if (examId) revalidatePath(`/examiner/exams/${examId}`, "layout")
}

export async function createExamAction(input: ExamInput) {
  return runAction(async () => {
    const actor = await requireRole("examiner")
    const r = await createExam(actor, input)
    refresh()
    return r
  }, "Draft exam created.")
}

export async function updateExamAction(input: ExamInput) {
  return runAction(async () => {
    const actor = await requireRole("examiner")
    const r = await updateExam(actor, input)
    refresh(r.id)
    return r
  }, "Exam settings saved.")
}

export async function setExamQuestionsAction(input: ExamQuestionsInput) {
  return runAction(async () => {
    const actor = await requireRole("examiner")
    const r = await setExamQuestions(actor, input)
    refresh(input.examId)
    return r
  }, "Question list saved.")
}

export async function publishExamAction(examId: string) {
  return runAction(async () => {
    const actor = await requireRole("examiner")
    await publishExam(actor, examId)
    refresh(examId)
  }, "Exam published. Enrolled candidates can see it now.")
}

export async function unpublishExamAction(examId: string) {
  return runAction(async () => {
    const actor = await requireRole("examiner")
    await unpublishExam(actor, examId)
    refresh(examId)
  }, "Exam moved back to draft.")
}

export async function closeExamAction(examId: string) {
  return runAction(async () => {
    const actor = await requireRole("examiner")
    const r = await closeExam(actor, examId, finalizeAllForExam)
    refresh(examId)
    return r
  }, "Exam closed. Open attempts were submitted with their saved answers.")
}

export async function deleteExamAction(examId: string) {
  return runAction(async () => {
    const actor = await requireRole("examiner")
    await deleteDraftExam(actor, examId)
    refresh()
  }, "Draft deleted.")
}

export async function searchCandidatesAction(examId: string, q: string) {
  return runAction(async () => {
    const actor = await requireRole("examiner", "admin")
    return searchCandidates(actor, examId, q)
  })
}

export async function enrollAction(examId: string, candidateIds: string[]) {
  return runAction(async () => {
    const actor = await requireRole("examiner")
    const r = await enrollCandidates(actor, { examId, candidateIds })
    refresh(examId)
    return r
  })
}

export async function unenrollAction(examId: string, candidateId: string) {
  return runAction(async () => {
    const actor = await requireRole("examiner")
    await unenrollCandidate(actor, examId, candidateId)
    refresh(examId)
  }, "Candidate removed from this exam.")
}

export async function startSandboxAction(examId: string) {
  return runAction(async () => {
    const actor = await requireRole("examiner")
    return startAttempt(actor, examId, { sandbox: true })
  })
}
