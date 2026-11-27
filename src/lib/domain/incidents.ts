/**
 * Declared incidents (I-5.3): one outage, many candidates. Pure rules shared by the
 * preview, the grant transaction and the tests, so what the examiner sees is exactly
 * what is applied.
 *
 * Fairness rules:
 * - Each candidate is compensated with their OWN server-measured loss of contact
 *   inside the declared window, never a flat amount. A candidate who stayed connected
 *   gets nothing; one who was cut off for 7 minutes gets 7.
 * - Background-tab silences are not outages and never count.
 * - Time already granted for an overlapping incident is subtracted, so declaring the
 *   same outage twice cannot pay twice.
 * - Whole minutes, rounded up, within the per-attempt cap.
 */
import { EXTENSION_CAP_SEC, GAP_THRESHOLD_MS, OUTAGE_CAUSES, type GapCause } from "./monitoring"

/** Longest window an examiner can declare as one incident. */
export const INCIDENT_MAX_WINDOW_MS = 6 * 3_600_000

export type GapSpan = { from: number; to: number; cause?: GapCause | null }

export function overlapMs(a0: number, a1: number, b0: number, b1: number) {
  return Math.max(0, Math.min(a1, b1) - Math.max(a0, b0))
}

/**
 * Seconds of measured outage inside [from, to]. `silentSince` is the last contact of a
 * candidate who has not come back yet: that silence has no gap event so far, but the
 * server can already measure it.
 */
export function outageInWindow(gaps: GapSpan[], silentSince: number | null, now: number, from: number, to: number) {
  let ms = 0
  for (const g of gaps) {
    // Older events without a cause predate the ledger: count them, as before.
    if (g.cause && !OUTAGE_CAUSES.includes(g.cause)) continue
    ms += overlapMs(g.from, g.to, from, to)
  }
  const stillOut = silentSince !== null && now - silentSince > GAP_THRESHOLD_MS
  if (stillOut) ms += overlapMs(silentSince, now, from, to)
  return { sec: Math.round(ms / 1000), stillOut }
}

export type CompensationStatus = "eligible" | "no_outage" | "already_compensated" | "at_cap" | "time_over"

export const COMPENSATION_LABEL: Record<CompensationStatus, string> = {
  eligible: "Will receive extra time",
  no_outage: "Stayed connected in this window",
  already_compensated: "Already compensated for this outage",
  at_cap: "Already at the extra time limit",
  time_over: "Time already ran out",
}

export function planCompensation(p: { outageSec: number; compensatedSec: number; extensionSec: number; deadlineAt: number; now: number }) {
  if (p.deadlineAt <= p.now) return { status: "time_over" as const, seconds: 0 }
  if (p.outageSec <= 0) return { status: "no_outage" as const, seconds: 0 }
  const owed = p.outageSec - p.compensatedSec
  if (owed <= 0) return { status: "already_compensated" as const, seconds: 0 }
  const room = Math.max(0, EXTENSION_CAP_SEC - p.extensionSec)
  if (room < 60) return { status: "at_cap" as const, seconds: 0 }
  const seconds = Math.min(room - (room % 60), Math.ceil(owed / 60) * 60)
  return { status: "eligible" as const, seconds }
}
