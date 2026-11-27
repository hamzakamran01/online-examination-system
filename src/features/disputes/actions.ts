"use server"

import { revalidatePath } from "next/cache"
import { requireRole } from "@/server/auth/guards"
import { runAction } from "@/server/errors"
import { raiseDispute, resolveDispute, withdrawDispute } from "@/server/services/disputes"
import type { RaiseDisputeInput, ResolveDisputeInput } from "@/lib/validation/disputes"

export async function raiseDisputeAction(input: RaiseDisputeInput) {
  return runAction(async () => {
    const actor = await requireRole("candidate")
    const r = await raiseDispute(actor, input)
    revalidatePath(`/candidate/results/${input.attemptId}`)
    return r
  }, "Dispute sent. Your examiner will review it and you will see the decision here.")
}

export async function withdrawDisputeAction(attemptId: string, disputeId: string) {
  return runAction(async () => {
    const actor = await requireRole("candidate")
    const r = await withdrawDispute(actor, { disputeId })
    revalidatePath(`/candidate/results/${attemptId}`)
    return r
  }, "Dispute withdrawn.")
}

export async function resolveDisputeAction(examId: string, input: ResolveDisputeInput) {
  return runAction(async () => {
    const actor = await requireRole("examiner")
    const r = await resolveDispute(actor, input)
    revalidatePath(`/examiner/exams/${examId}`, "layout")
    return r
  })
}
