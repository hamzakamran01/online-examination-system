import { z } from "zod"
import { DISPUTE_TYPES } from "@/lib/domain/disputes"

/** Candidate raises a dispute on one question of their own published result (I-5.4). */
export const raiseDisputeSchema = z.object({
  attemptId: z.uuid(),
  itemId: z.uuid(),
  type: z.enum(DISPUTE_TYPES, "Choose what kind of problem this is."),
  statement: z
    .string()
    .trim()
    .min(20, "Explain the problem in at least 20 characters so the examiner can assess it.")
    .max(1000, "Keep it under 1,000 characters."),
})
export type RaiseDisputeInput = z.input<typeof raiseDisputeSchema>

export const withdrawDisputeSchema = z.object({ disputeId: z.uuid() })

const note = z
  .string()
  .trim()
  .min(10, "Explain the decision (at least 10 characters). The candidate will read it.")
  .max(1000, "Keep it under 1,000 characters.")

/** Examiner decision. Every outcome needs a written explanation that the candidate sees. */
export const resolveDisputeSchema = z.discriminatedUnion("outcome", [
  z.object({ disputeId: z.uuid(), outcome: z.literal("reject"), note }),
  z.object({
    disputeId: z.uuid(),
    outcome: z.literal("regrade"),
    marks: z.coerce.number("Enter the new mark.").min(0, "Marks cannot be negative.").max(1000),
    note,
  }),
  z.object({
    disputeId: z.uuid(),
    outcome: z.literal("void"),
    policy: z.enum(["exclude", "full_marks"], "Choose how the void applies to everyone."),
    note,
  }),
])
export type ResolveDisputeInput = z.input<typeof resolveDisputeSchema>
