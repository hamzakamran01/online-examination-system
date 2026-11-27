import { z } from "zod"

export const answerResponseSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("choice"), selected: z.array(z.uuid()).max(8) }),
  z.object({ kind: z.literal("text"), text: z.string().max(20_000, "Answer is too long (20,000 characters max).") }),
])

export const saveAnswersSchema = z.object({
  clientId: z.string().min(8).max(64),
  answers: z
    .array(
      z.object({
        itemId: z.uuid(),
        response: answerResponseSchema.nullable(),
        flagged: z.boolean(),
        seq: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
      })
    )
    .min(1)
    .max(200),
})
export type SaveAnswersInput = z.infer<typeof saveAnswersSchema>
