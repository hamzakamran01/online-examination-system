"use server"

import { requireRole } from "@/server/auth/guards"
import { runAction } from "@/server/errors"
import { startAttempt } from "@/server/services/attempts"

export async function startAttemptAction(examId: string) {
  return runAction(async () => {
    const actor = await requireRole("candidate")
    return startAttempt(actor, examId)
  })
}
