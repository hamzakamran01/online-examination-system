/**
 * Trust and dispute resolution (I-5.4). Rules shared by the server, the candidate
 * result page, the examiner review screens and the tests.
 */

/** Disputes can be raised for this long after results are published. */
export const DISPUTE_WINDOW_DAYS = 7
export const DISPUTE_WINDOW_MS = DISPUTE_WINDOW_DAYS * 24 * 3_600_000
/** At most this many disputes per attempt: enough for real problems, not a way to appeal everything. */
export const MAX_DISPUTES_PER_ATTEMPT = 5
/** A question is flagged as attracting disputes at this count, or at this share of submitted attempts. */
export const HOTSPOT_MIN_DISPUTES = 2
export const HOTSPOT_MIN_RATE = 0.2

export const DISPUTE_TYPES = ["grading_error", "ambiguous_question", "technical_incident"] as const
export type DisputeType = (typeof DISPUTE_TYPES)[number]
export type DisputeStatus = "open" | "regraded" | "rejected" | "voided" | "withdrawn"
export type VoidPolicy = "exclude" | "full_marks"

export const DISPUTE_TYPE_LABEL: Record<DisputeType, string> = {
  grading_error: "Grading error",
  ambiguous_question: "Ambiguous or incorrect question",
  technical_incident: "Technical incident",
}

export const DISPUTE_TYPE_HELP: Record<DisputeType, string> = {
  grading_error: "My answer deserves different marks under the marking scheme.",
  ambiguous_question: "The question could be read more than one way, or its answer key is wrong.",
  technical_incident: "A connection, device or system problem affected my answer to this question.",
}

export const DISPUTE_STATUS_LABEL: Record<DisputeStatus, string> = {
  open: "Under review",
  regraded: "Upheld: marks changed",
  rejected: "Reviewed: marks unchanged",
  voided: "Upheld: question voided for everyone",
  withdrawn: "Withdrawn",
}

export const VOID_POLICY_LABEL: Record<VoidPolicy, string> = {
  exclude: "Remove the question from every paper (total marks shrink)",
  full_marks: "Award full marks to every candidate",
}

export function disputeWindow(resultsPublishedAt: Date | null, now = new Date()) {
  if (!resultsPublishedAt) return { open: false, closesAt: null as Date | null, reason: "Results are not published yet." }
  const closesAt = new Date(resultsPublishedAt.getTime() + DISPUTE_WINDOW_MS)
  return closesAt > now
    ? { open: true, closesAt, reason: null }
    : { open: false, closesAt, reason: `The dispute window closed on ${closesAt.toISOString()}.` }
}

/** Whether a question's dispute volume deserves the examiner's attention. */
export function isHotspot(disputes: number, finalizedAttempts: number) {
  return disputes >= HOTSPOT_MIN_DISPUTES || (finalizedAttempts > 0 && disputes / finalizedAttempts >= HOTSPOT_MIN_RATE && disputes > 0)
}
