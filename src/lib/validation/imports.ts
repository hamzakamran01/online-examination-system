import { z } from "zod"
import { readCsv } from "@/lib/csv"
import { createUserSchema } from "./users"
import { questionSchema } from "./questions"

export const importSchema = z.object({
  kind: z.enum(["candidates", "questions"]),
  format: z.enum(["csv", "json"]),
  examId: z.uuid().optional(),
  source: z
    .string()
    .min(1)
    .refine((s) => new TextEncoder().encode(s).length <= 1048576, "File exceeds 1 MB."),
})
export type Upload = z.infer<typeof importSchema>
export type Preview = { line: number; values: string; errors: string[] }
export type Outcome = {
  rows: Preview[]
  imported: number
  created: number
  reused: number
  enrolled: number
  questions: number
  skipped: number
  passwords: { email: string; password: string }[]
}

const candidateSchema = createUserSchema.omit({ role: true }).extend({
  password: createUserSchema.shape.password.optional(),
})
const parts = (v: unknown): unknown[] => (Array.isArray(v) ? v : v == null || v === "" ? [] : String(v).split("|"))

export function readRows(input: Upload): { line: number; value: unknown; error?: string }[] {
  const source = input.source.replace(/^\uFEFF/, "")
  if (input.format === "json") {
    let rows: unknown
    try {
      rows = JSON.parse(source)
    } catch {
      throw Error("Invalid JSON.")
    }
    if (!Array.isArray(rows) || rows.length > 500) throw Error("Provide an array of at most 500 rows.")
    return rows.map((value, i) => ({ line: i + 1, value }))
  }
  const [header, ...records] = readCsv(source)
  const names = header?.cells.map((s) => s.trim()) ?? []
  if (names.some((s) => !s) || new Set(names).size !== names.length) throw Error("Use unique, nonempty column names.")
  return records.map(({ line, cells }) => ({
    line,
    value: Object.fromEntries(names.map((name, i) => [name, cells[i]])),
    error: cells.length > names.length ? "Row: Too many columns." : undefined,
  }))
}

export function candidateRow(row: Record<string, unknown>) {
  return candidateSchema.safeParse({ ...row, password: row.password || undefined })
}
export function questionRow(row: Record<string, unknown>) {
  const options = parts(row.options)
  const correct = parts(row.correct).map(Number)
  const parsed = questionSchema.safeParse({
    type: row.type,
    topicName: row.topic,
    difficulty: row.difficulty,
    stem: row.stem,
    defaultMarks: row.marks,
    multiScheme: row.scheme || undefined,
    rubric: row.rubric,
    options: options.map((text, i) => ({ text, isCorrect: correct.includes(i + 1) })),
  })
  const invalidIndex = correct.some((n) => !Number.isInteger(n) || n < 1 || n > options.length)
  return { parsed, invalidIndex }
}
