/**
 * Frozen attempt paper. Built once at attempt start and never mutated
 * (invariant 2). The `Paper` is candidate-safe; the `AnswerKey` is server-only.
 */

export type PaperOption = { id: string; text: string }

export type PaperItem = {
  /** Question id at the time of freezing. Also the answer row key. */
  itemId: string
  type: "single" | "multi" | "written"
  stem: string
  marks: number
  scheme: "all_or_nothing" | "partial"
  topic: string | null
  difficulty: "easy" | "medium" | "hard"
  /** Options in the order this candidate sees them. Empty for written. */
  options: PaperOption[]
  /** Secure mode: seconds this question stays open, frozen at start. */
  timeLimitSec?: number
}

/** `mode` is frozen at start, so changing the exam later never changes a running attempt. */
export type Paper = { items: PaperItem[]; mode?: "standard" | "secure" }

/** itemId -> correct option ids (written items have an empty list and a rubric). */
export type AnswerKey = Record<string, { correct: string[]; rubric?: string | null }>

export type AnswerResponse = { kind: "choice"; selected: string[] } | { kind: "text"; text: string }
