import { z } from "zod"
import { CLIENT_SIGNAL_TYPES, EXTENSION_CAP_SEC } from "@/lib/domain/monitoring"
import { INCIDENT_MAX_WINDOW_MS } from "@/lib/domain/incidents"

/** One client observed signal. Durations are measured with the monotonic clock on the device. */
export const clientSignalSchema = z.object({
  type: z.enum(CLIENT_SIGNAL_TYPES),
  durationMs: z.number().int().min(0).max(24 * 3_600_000).optional(),
  /** Device clock at the moment of the signal. Informational only: the server stamps its own time. */
  at: z.number().int().positive().max(4_102_444_800_000).optional(),
})
export type ClientSignal = z.infer<typeof clientSignalSchema>

/**
 * Presence ledger (I-5.3): how long, since the last acknowledged contact, the tab was hidden
 * and the device reported offline. Measured with the monotonic clock. It only explains a
 * silence the server measured itself; it can never shorten or lengthen the deadline.
 */
const DAY_MS = 24 * 3_600_000
export const presenceSchema = z.object({
  hiddenMs: z.number().int().min(0).max(DAY_MS),
  offlineMs: z.number().int().min(0).max(DAY_MS),
  visible: z.boolean(),
})
export type Presence = z.infer<typeof presenceSchema>

/** Workspace heartbeat (I-5.3). Carries queued signals so they survive short outages. */
export const heartbeatSchema = z.object({
  clientId: z.string().min(8).max(64),
  signals: z.array(clientSignalSchema).max(50).default([]),
  presence: presenceSchema.optional(),
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

/** Incident window (I-5.3). Dates are ISO strings on the wire; the server validates against its own clock. */
export const incidentWindowSchema = z
  .object({
    from: z.iso.datetime({ offset: true, message: "Choose when the outage started." }),
    to: z.iso.datetime({ offset: true, message: "Choose when the outage ended." }),
  })
  .refine((w) => Date.parse(w.to) > Date.parse(w.from), { path: ["to"], message: "The end must be after the start." })
  .refine((w) => Date.parse(w.to) - Date.parse(w.from) <= INCIDENT_MAX_WINDOW_MS, { path: ["to"], message: "Declare at most 6 hours at a time." })
export type IncidentWindowInput = z.input<typeof incidentWindowSchema>

export const declareIncidentSchema = z
  .object({
    from: z.iso.datetime({ offset: true }),
    to: z.iso.datetime({ offset: true }),
    reason: z.string().trim().min(10, "Describe the incident (at least 10 characters).").max(300, "Keep the reason under 300 characters."),
    /** Generated once per dialog: a retried or double-clicked grant applies exactly once. */
    requestKey: z.uuid(),
  })
  .refine((w) => Date.parse(w.to) > Date.parse(w.from), { path: ["to"], message: "The end must be after the start." })
  .refine((w) => Date.parse(w.to) - Date.parse(w.from) <= INCIDENT_MAX_WINDOW_MS, { path: ["to"], message: "Declare at most 6 hours at a time." })
export type DeclareIncidentInput = z.input<typeof declareIncidentSchema>
