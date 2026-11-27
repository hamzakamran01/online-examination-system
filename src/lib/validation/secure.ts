import { z } from "zod"
import { LOCK_REASONS, MAX_TIME_LIMIT_SEC, MIN_TIME_LIMIT_SEC } from "@/lib/domain/secure"
import { answerResponseSchema } from "./attempts"

/** Submit the open question and move on. `index` names the question being closed (idempotency). */
export const advanceSchema = z.object({
  index: z.number().int().min(0).max(500),
  response: answerResponseSchema.nullable().optional(),
  seq: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER).default(1),
})
export type AdvanceInput = z.input<typeof advanceSchema>

export const lockSchema = z.object({ reason: z.enum(LOCK_REASONS) })

export const releaseSchema = z.object({
  attemptId: z.uuid(),
  note: z.string().trim().min(5, "Say why you are letting the candidate continue (at least 5 characters).").max(300, "Keep it under 300 characters."),
})
export type ReleaseInput = z.input<typeof releaseSchema>

export const unlockWithCodeSchema = z.object({
  code: z.string().trim().regex(/^\d{6}$/, "Enter the 6 digit code from your examiner."),
})

/** Per-question time limit set while building the paper (seconds, or empty for the type default). */
export const timeLimitSchema = z
  .union([z.literal(""), z.null(), z.coerce.number().int("Use whole seconds.").min(MIN_TIME_LIMIT_SEC, `At least ${MIN_TIME_LIMIT_SEC} seconds.`).max(MAX_TIME_LIMIT_SEC, "At most one hour.")])
  .optional()
  .transform((v) => (v === "" || v === undefined || v === null ? null : v))
