import type { AnswerKey, AnswerResponse, PaperItem } from "@/lib/domain/paper"

const round2 = (n: number) => Math.round(n * 100) / 100

/**
 * Objective marking (C-3.7.1). Returns null for written items (manual grading).
 * - single: full marks only when the one correct option is selected.
 * - multi, all_or_nothing: full marks only when the selected set equals the correct set.
 * - multi, partial: marks * max(0, (correctSelected - wrongSelected) / correctCount).
 *   Selecting every option therefore never earns credit on its own.
 * Unanswered objective items score 0.
 */
export function scoreItem(item: PaperItem, key: AnswerKey[string] | undefined, response: AnswerResponse | null | undefined): number | null {
  if (item.type === "written") return null
  if (!key) return 0
  const selected = new Set(response?.kind === "choice" ? response.selected : [])
  const correct = new Set(key.correct)
  if (selected.size === 0) return 0

  if (item.type === "single") {
    return selected.size === 1 && correct.has([...selected][0]) ? item.marks : 0
  }

  const correctSelected = [...selected].filter((id) => correct.has(id)).length
  const wrongSelected = selected.size - correctSelected
  if (item.scheme === "all_or_nothing") {
    return wrongSelected === 0 && correctSelected === correct.size ? item.marks : 0
  }
  return round2(item.marks * Math.max(0, (correctSelected - wrongSelected) / correct.size))
}

export function isAnswered(response: AnswerResponse | null | undefined) {
  if (!response) return false
  return response.kind === "choice" ? response.selected.length > 0 : response.text.trim().length > 0
}
