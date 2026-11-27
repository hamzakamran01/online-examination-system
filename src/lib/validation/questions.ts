import { z } from "zod"

export const QUESTION_TYPES = ["single", "multi", "written"] as const
export const DIFFICULTIES = ["easy", "medium", "hard"] as const
export const MULTI_SCHEMES = ["all_or_nothing", "partial"] as const

export const TYPE_LABEL = { single: "Single answer", multi: "Multiple select", written: "Written" } as const
export const DIFFICULTY_LABEL = { easy: "Easy", medium: "Medium", hard: "Hard" } as const
export const SCHEME_LABEL = { all_or_nothing: "All or nothing", partial: "Partial credit" } as const

const marks = z.coerce
  .number("Enter a number.")
  .positive("Marks must be greater than 0.")
  .max(100, "Marks cannot exceed 100.")
  .refine((n) => Math.round(n * 2) === n * 2, "Use whole or half marks (for example 1 or 1.5).")

export const optionSchema = z.object({
  text: z.string().trim().min(1, "Option text is required.").max(500, "Option is too long."),
  isCorrect: z.boolean(),
})

/**
 * One schema for create and edit. Type-specific rules (C-3.3.2):
 * single needs exactly one correct option, multi needs at least one,
 * objective questions need 2 to 8 unique options, written has none.
 */
export const questionSchema = z
  .object({
    id: z.uuid().optional(),
    type: z.enum(QUESTION_TYPES),
    stem: z.string().trim().min(5, "Question text must be at least 5 characters.").max(4000, "Question text is too long."),
    topicName: z.string().trim().max(60, "Topic name is too long.").optional().default(""),
    difficulty: z.enum(DIFFICULTIES),
    defaultMarks: marks,
    multiScheme: z.enum(MULTI_SCHEMES).default("all_or_nothing"),
    rubric: z.string().trim().max(2000, "Rubric is too long.").optional().default(""),
    options: z.array(optionSchema).default([]),
  })
  .superRefine((q, ctx) => {
    if (q.type === "written") {
      if (q.options.length) ctx.addIssue({ code: "custom", path: ["options"], message: "Written questions do not have options." })
      return
    }
    if (q.options.length < 2) ctx.addIssue({ code: "custom", path: ["options"], message: "Add at least 2 options." })
    if (q.options.length > 8) ctx.addIssue({ code: "custom", path: ["options"], message: "Use at most 8 options." })
    const texts = q.options.map((o) => o.text.toLowerCase())
    if (new Set(texts).size !== texts.length) ctx.addIssue({ code: "custom", path: ["options"], message: "Options must be unique." })
    const correct = q.options.filter((o) => o.isCorrect).length
    if (q.type === "single" && correct !== 1)
      ctx.addIssue({ code: "custom", path: ["options"], message: "Mark exactly one option as correct." })
    if (q.type === "multi" && correct < 1)
      ctx.addIssue({ code: "custom", path: ["options"], message: "Mark at least one option as correct." })
  })
export type QuestionInput = z.input<typeof questionSchema>
export type QuestionData = z.output<typeof questionSchema>

export const questionFilterSchema = z.object({
  q: z.string().trim().max(100).optional(),
  type: z.enum(QUESTION_TYPES).optional(),
  difficulty: z.enum(DIFFICULTIES).optional(),
  topic: z.uuid().optional(),
})
export type QuestionFilter = z.infer<typeof questionFilterSchema>
