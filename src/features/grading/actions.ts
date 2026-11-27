"use server"

import { revalidatePath } from "next/cache"
import { requireRole } from "@/server/auth/guards"
import { runAction } from "@/server/errors"
import { gradeAnswer, publishResults } from "@/server/services/grading"
import type { GradeAnswerInput } from "@/lib/validation/grading"

export async function gradeAnswerAction(examId: string, input: GradeAnswerInput) {
  return runAction(async () => {
    const actor = await requireRole("examiner")
    const r = await gradeAnswer(actor, input)
    revalidatePath(`/examiner/exams/${examId}/results`, "layout")
    return r
  })
}

export async function publishResultsAction(examId: string) {
  return runAction(async () => {
    const actor = await requireRole("examiner")
    await publishResults(actor, examId)
    revalidatePath(`/examiner/exams/${examId}`, "layout")
    revalidatePath("/candidate")
  }, "Results published. Candidates can now see their scores.")
}
