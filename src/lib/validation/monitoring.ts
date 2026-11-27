import { z } from "zod"
import { CLIENT_SIGNAL_TYPES, EXTENSION_CAP_SEC } from "@/lib/domain/monitoring"

/** One client observed signal. Durations are measured with the monotonic clock on the device. */
export const clientSignalSchema = z.object({
  type: z.enum(CLIENT_SIGNAL_TYPES),
  durationMs: z.number().int().min(0).max(24 * 3_600_000).optional(),
  /** Device clock at the moment of the signal. Informational only: the server stamps its own time. */
  at: z.number().int().positive().max(4_102_444_800_000).optional(),
})
export type ClientSignal = z.infer<typeof clientSignalSchema>

/** Workspace heartbeat (I-5.3). Carries queued signals so they survive short outages. */
export const heartbeatSchema = z.object({
  clientId: z.string().min(8).max(64),
  signals: z.array(clientSignalSchema).max(50).default([]),
})
export type HeartbeatInput = z.input<typeof heartbeatSchema>

/** Examiner announcement to every candidate of an exam (C-3.6.2). */
export const announcementSchema = z.object({
  body: z
    .string()
    .trim()
    .min(3, "Write at least a few words.")
    .max(500, "Keep announcements under 500 characters."),
})
export type AnnouncementInput = z.input<typeof announcementSchema>

/** Examiner granted extra time (I-5.3). Reason is mandatory and audited. */
export const extensionSchema = z.object({
  attemptId: z.uuid(),
  minutes: z.coerce
    .number("Enter minutes.")
    .int("Use whole minutes.")
    .min(1, "Grant at least 1 minute.")
    .max(EXTENSION_CAP_SEC / 60, `At most ${EXTENSION_CAP_SEC / 60} minutes per attempt.`),
  reason: z.string().trim().min(5, "Give a short reason (at least 5 characters).").max(300, "Keep the reason under 300 characters."),
})
export type ExtensionInput = z.input<typeof extensionSchema>
