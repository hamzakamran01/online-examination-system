/**
 * Score composition (invariant 10, I-5.4). Pure and shared by the grader, the
 * candidate result, PDF reports and recalculation, so every screen agrees.
 *
 * Precedence for one paper item:
 * 1. Voided for the whole exam: `exclude` removes it from score and maximum,
 *    `full_marks` awards its full marks to every candidate.
 * 2. Written: the examiner's manual mark (pending until graded; blank answers score 0).
 * 3. Objective: an examiner override (set when a dispute is upheld) wins over the
 *    automatic mark from the frozen answer key.
 */
import type { PaperItem } from "./paper"

export type VoidRule = "exclude" | "full_marks"
export type ScoreRow = { autoScore: number | null; manualScore: number | null }

export type ItemOutcome = {
  /** Awarded marks, or null while a written answer waits for grading. */
  score: number | null
  /** Marks this item counts towards the maximum (0 when excluded). */
  max: number
  voided: VoidRule | null
  /** Objective mark set by an examiner instead of the answer key. */
  overridden: boolean
  bucket: "auto" | "manual"
}

const r2 = (n: number) => Math.round(n * 100) / 100

export function itemOutcome(item: Pick<PaperItem, "type" | "marks">, row: ScoreRow | undefined, voided: VoidRule | null | undefined): ItemOutcome {
  if (voided === "exclude") return { score: 0, max: 0, voided, overridden: false, bucket: "auto" }
  if (voided === "full_marks") return { score: item.marks, max: item.marks, voided, overridden: false, bucket: "auto" }
  if (item.type === "written") {
    // No row at all means the candidate never typed anything: nothing to grade, scores 0.
    const score = row ? row.manualScore : 0
    return { score, max: item.marks, voided: null, overridden: false, bucket: "manual" }
  }
  if (row?.manualScore !== null && row?.manualScore !== undefined)
    return { score: row.manualScore, max: item.marks, voided: null, overridden: true, bucket: "manual" }
  return { score: row?.autoScore ?? 0, max: item.marks, voided: null, overridden: false, bucket: "auto" }
}

export function attemptTotals(
  items: Pick<PaperItem, "itemId" | "type" | "marks">[],
  rows: Map<string, ScoreRow>,
  voids: Map<string, VoidRule>
) {
  let auto = 0
  let manual = 0
  let max = 0
  let pending = 0
  for (const item of items) {
    const o = itemOutcome(item, rows.get(item.itemId), voids.get(item.itemId))
    max += o.max
    if (o.score === null) pending++
    else if (o.bucket === "auto") auto += o.score
    else manual += o.score
  }
  return { scoreAuto: r2(auto), scoreManual: r2(manual), scoreTotal: r2(auto + manual), maxMarks: r2(max), pending }
}
