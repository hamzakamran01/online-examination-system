import { z } from "zod"

const halfMarks = (label: string) =>
  z.coerce
    .number("Enter a number.")
    .positive(`${label} must be greater than 0.`)
    .max(1000, `${label} cannot exceed 1000.`)
    .refine((n) => Math.round(n * 2) === n * 2, "Use whole or half marks.")

/** Exam settings form (C-3.2.1). Times are ISO strings produced in the browser. */
export const examSchema = z
  .object({
    id: z.uuid().optional(),
    title: z.string().trim().min(3, "Title must be at least 3 characters.").max(120, "Title is too long."),
    instructions: z.string().trim().max(5000, "Instructions are too long.").default(""),
    startsAt: z.iso.datetime({ offset: true, message: "Choose a start date and time." }),
    endsAt: z.iso.datetime({ offset: true, message: "Choose an end date and time." }),
    durationMin: z.coerce.number("Enter a number.").int("Use whole minutes.").min(1, "At least 1 minute.").max(600, "At most 600 minutes."),
    totalMarks: halfMarks("Total marks"),
    passMark: z
      .union([z.literal(""), z.coerce.number().min(0, "Pass mark cannot be negative.")])
      .optional()
      .transform((v) => (v === "" || v === undefined ? null : v)),
    shuffleQuestions: z.boolean().default(true),
    shuffleOptions: z.boolean().default(true),
    releaseAnswerReview: z.boolean().default(false),
  })
  .superRefine((e, ctx) => {
    const start = Date.parse(e.startsAt)
    const end = Date.parse(e.endsAt)
    if (end <= start) ctx.addIssue({ code: "custom", path: ["endsAt"], message: "The window must end after it starts." })
    else if (e.durationMin * 60_000 > end - start)
      ctx.addIssue({ code: "custom", path: ["durationMin"], message: "Duration is longer than the availability window." })
    if (e.passMark !== null && e.passMark > e.totalMarks)
      ctx.addIssue({ code: "custom", path: ["passMark"], message: "Pass mark cannot exceed total marks." })
  })
export type ExamInput = z.input<typeof examSchema>
export type ExamData = z.output<typeof examSchema>

export const examQuestionsSchema = z.object({
  examId: z.uuid(),
  items: z
    .array(z.object({ questionId: z.uuid(), marks: halfMarks("Marks") }))
    .max(200, "An exam can have at most 200 questions.")
    .refine((items) => new Set(items.map((i) => i.questionId)).size === items.length, "A question can only be added once."),
})
export type ExamQuestionsInput = z.input<typeof examQuestionsSchema>

export const enrollSchema = z.object({
  examId: z.uuid(),
  candidateIds: z.array(z.string().min(1)).min(1, "Select at least one candidate.").max(500),
})
