/**
 * Effective lifecycle (C-3.2.2). Stored status is draft | published | completed;
 * "ongoing" is derived from the server clock so it can never drift from the schedule.
 */
export type EffectiveStatus = "draft" | "published" | "ongoing" | "completed"

export function effectiveStatus(
  exam: { status: "draft" | "published" | "completed"; startsAt: Date; endsAt: Date },
  now: Date = new Date()
): EffectiveStatus {
  if (exam.status === "draft") return "draft"
  if (exam.status === "completed") return "completed"
  if (now < exam.startsAt) return "published"
  if (now < exam.endsAt) return "ongoing"
  return "completed"
}

export const STATUS_LABEL: Record<EffectiveStatus, string> = {
  draft: "Draft",
  published: "Scheduled",
  ongoing: "Ongoing",
  completed: "Completed",
}

export const STATUS_TONE: Record<EffectiveStatus, "muted" | "info" | "success" | "secondary"> = {
  draft: "muted",
  published: "info",
  ongoing: "success",
  completed: "secondary",
}
