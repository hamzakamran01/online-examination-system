import { z } from "zod"

/** Manual mark for one written answer (C-3.7.2). Upper bound is checked against the frozen paper on the server. */
export const gradeAnswerSchema = z.object({
  attemptId: z.uuid(),
  itemId: z.uuid(),
  marks: z.coerce
    .number("Enter a mark.")
    .min(0, "Marks cannot be negative.")
    .refine((n) => Math.round(n * 2) === n * 2, "Use whole or half marks."),
  feedback: z.string().trim().max(2000, "Feedback is too long.").optional().default(""),
  reason: z.string().trim().max(500, "Reason is too long.").optional().default(""),
})
export type GradeAnswerInput = z.input<typeof gradeAnswerSchema>
