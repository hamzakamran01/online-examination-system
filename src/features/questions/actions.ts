"use server"

import { revalidatePath } from "next/cache"
import { requireRole } from "@/server/auth/guards"
import { runAction } from "@/server/errors"
import { archiveQuestion, duplicateQuestion, saveQuestion } from "@/server/services/questions"
import type { QuestionInput } from "@/lib/validation/questions"

export async function saveQuestionAction(input: QuestionInput) {
  return runAction(async () => {
    const actor = await requireRole("examiner")
    const r = await saveQuestion(actor, input)
    revalidatePath("/examiner/bank")
    return r
  }, input.id ? "Question updated." : "Question added to your bank.")
}

export async function duplicateQuestionAction(id: string) {
  return runAction(async () => {
    const actor = await requireRole("examiner")
    const r = await duplicateQuestion(actor, id)
    revalidatePath("/examiner/bank")
    return r
  }, "Question duplicated.")
}

export async function archiveQuestionAction(id: string) {
  return runAction(async () => {
    const actor = await requireRole("examiner")
    await archiveQuestion(actor, id)
    revalidatePath("/examiner/bank")
  }, "Question archived.")
}
