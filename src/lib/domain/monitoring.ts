/**
 * Live monitoring and resilience rules (C-3.6, I-5.3). Pure functions and
 * constants shared by the server, the candidate workspace and the tests.
 */

/** Candidate workspace heartbeat interval. */
export const HEARTBEAT_MS = 15_000
/** No save or heartbeat for this long: the monitor shows the candidate as disconnected. */
export const DISCONNECT_AFTER_MS = 30_000
/** Silence longer than this is recorded by the server as a measured connection gap. */
export const GAP_THRESHOLD_MS = 45_000
/** Examiner monitor poll interval. */
export const MONITOR_POLL_MS = 5_000
/** Client reported signals stored per attempt. Beyond this they are dropped (abuse guard). */
export const CLIENT_SIGNAL_CAP = 200
/** Tab switches shorter than this are not recorded (accidental alt-tab, notification). */
export const MIN_TAB_AWAY_MS = 1_000
/** Total extra time an examiner may grant to one attempt. */
export const EXTENSION_CAP_SEC = 15 * 60
/** Repeated device_change events inside this window are collapsed into one. */
export const DEVICE_CHANGE_DEDUPE_MS = 2 * 60_000

export type LiveState = "not_started" | "writing" | "disconnected" | "submitted"

export const LIVE_STATE_LABEL: Record<LiveState, string> = {
  not_started: "Not started",
  writing: "Writing",
  disconnected: "Disconnected",
  submitted: "Submitted",
}

/** Monitor state of one enrolled candidate, derived from server data only. */
export function deriveLiveState(
  attempt: { status: "in_progress" | "submitted" | "auto_submitted"; lastSeenAt: Date | null; startedAt: Date } | null,
  now: Date
): LiveState {
  if (!attempt) return "not_started"
  if (attempt.status !== "in_progress") return "submitted"
  const seen = (attempt.lastSeenAt ?? attempt.startedAt).getTime()
  return now.getTime() - seen > DISCONNECT_AFTER_MS ? "disconnected" : "writing"
}

/** Seconds of silence worth recording as a connection gap, or null when within normal heartbeat jitter. */
export function measureGapSec(lastSeenAt: Date | null, now: Date): number | null {
  if (!lastSeenAt) return null
  const ms = now.getTime() - lastSeenAt.getTime()
  return ms > GAP_THRESHOLD_MS ? Math.round(ms / 1000) : null
}

/**
 * Why the server heard nothing (I-5.3). Browsers throttle timers in background tabs
 * (Chrome to about one tick a minute), so a hidden tab alone can look like an outage.
 * - `background_tab`: the tab was hidden for (almost) the whole silence. Not an outage.
 * - `device_offline`: the device itself reported no network for a meaningful part of it.
 * - `no_contact`: the tab was visible and the device online, yet nothing reached the
 *   server: a network path or server problem. The strongest evidence for extra time.
 */
export type GapCause = "background_tab" | "device_offline" | "no_contact"

export const GAP_CAUSE_LABEL: Record<GapCause, string> = {
  background_tab: "Tab in background (browser slowed its timers)",
  device_offline: "Device reported no network",
  no_contact: "Visible and online, but nothing reached the server",
}

/** Gaps of these causes are outages worth compensating; background tabs are not. */
export const OUTAGE_CAUSES: readonly GapCause[] = ["device_offline", "no_contact"]

export function classifyGap(gapMs: number, presence: { hiddenMs: number; offlineMs: number } | null | undefined): GapCause {
  if (!presence) return "no_contact"
  const hidden = Math.min(presence.hiddenMs, gapMs)
  const offline = Math.min(presence.offlineMs, gapMs)
  // A real loss of network wins: the candidate could not have reached us even if visible.
  if (offline >= GAP_THRESHOLD_MS || offline >= gapMs / 2) return "device_offline"
  // Visible for less than one gap threshold: the silence is explained by throttled timers.
  if (gapMs - hidden < GAP_THRESHOLD_MS) return "background_tab"
  return "no_contact"
}

/** Suggested extension: the measured outage not yet compensated, in whole minutes, within the cap. */
export function suggestExtensionSec(measuredGapSec: number, alreadyGrantedSec: number): number {
  const room = Math.max(0, EXTENSION_CAP_SEC - alreadyGrantedSec)
  const owed = Math.max(0, measuredGapSec - alreadyGrantedSec)
  const minutes = Math.max(1, Math.ceil(owed / 60))
  return Math.min(room, minutes * 60)
}

/** Client reported signal types. Server events (gaps, device change, late saves) are never accepted from the client. */
export const CLIENT_SIGNAL_TYPES = ["tab_hidden", "fullscreen_exit", "offline", "reconnect"] as const
export type ClientSignalType = (typeof CLIENT_SIGNAL_TYPES)[number]

/** Wording follows invariant 8: signals for review, never proof. */
export const SIGNAL_LABEL: Record<string, string> = {
  started: "Started the exam",
  resumed: "Resumed the exam",
  tab_hidden: "Left the exam tab",
  fullscreen_exit: "Left full screen",
  offline: "Device reported offline",
  reconnect: "Reconnected",
  connection_gap: "No contact with the server",
  device_change: "Continued on another browser or device",
  late_save_rejected: "Answers arrived after the deadline",
  extension_granted: "Extra time granted",
  submitted: "Submitted",
  auto_submitted: "Submitted automatically",
}

/** Events that count as review signals on the monitor. Lifecycle events are context, not signals. */
export const REVIEW_SIGNAL_TYPES = [
  "tab_hidden",
  "fullscreen_exit",
  "offline",
  "connection_gap",
  "device_change",
  "late_save_rejected",
] as const

export const SIGNAL_DISCLAIMER =
  "Signals are recorded for review only. They can have innocent causes (a notification, a weak network, a flat battery) and are never proof of misconduct. Signals never end or penalise an attempt."
