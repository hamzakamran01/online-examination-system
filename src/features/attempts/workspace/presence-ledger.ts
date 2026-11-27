"use client"

/**
 * Presence ledger (I-5.3). Accumulates, with the monotonic clock, how long the tab
 * was hidden and how long the device reported offline since the last request the
 * server acknowledged. Heartbeats and autosaves both send it, so whichever request
 * first reaches the server after a silence explains that silence.
 *
 * Why: browsers throttle timers in background tabs, so a hidden tab can go a minute
 * without a heartbeat. Without this ledger the server would record that as an outage.
 * The ledger never changes timing: the server still measures the gap itself.
 */
import type { Presence } from "@/lib/validation/monitoring"

type State = { hiddenMs: number; offlineMs: number; hiddenSince: number | null; offlineSince: number | null }

let state: State | null = null
let users = 0
let detach: (() => void) | null = null

const now = () => performance.now()

function ensure(): State {
  if (state) return state
  state = {
    hiddenMs: 0,
    offlineMs: 0,
    hiddenSince: typeof document !== "undefined" && document.visibilityState === "hidden" ? now() : null,
    offlineSince: typeof navigator !== "undefined" && !navigator.onLine ? now() : null,
  }
  return state
}

/** Starts tracking (reference counted, so the heartbeat and the sync engine can share it). */
export function attachPresenceLedger() {
  const s = ensure()
  users++
  if (!detach) {
    const onVisibility = () => {
      if (document.visibilityState === "hidden") s.hiddenSince ??= now()
      else if (s.hiddenSince !== null) {
        s.hiddenMs += now() - s.hiddenSince
        s.hiddenSince = null
      }
    }
    const onOffline = () => {
      s.offlineSince ??= now()
    }
    const onOnline = () => {
      if (s.offlineSince !== null) {
        s.offlineMs += now() - s.offlineSince
        s.offlineSince = null
      }
    }
    document.addEventListener("visibilitychange", onVisibility)
    window.addEventListener("offline", onOffline)
    window.addEventListener("online", onOnline)
    detach = () => {
      document.removeEventListener("visibilitychange", onVisibility)
      window.removeEventListener("offline", onOffline)
      window.removeEventListener("online", onOnline)
    }
  }
  return () => {
    users = Math.max(0, users - 1)
    if (!users && detach) {
      detach()
      detach = null
      state = null
    }
  }
}

/** Current totals including any span still running. Pass `taken` back to `ackPresence`. */
export function snapshotPresence(): { presence: Presence; taken: number } {
  const s = ensure()
  const t = now()
  const hidden = s.hiddenMs + (s.hiddenSince !== null ? t - s.hiddenSince : 0)
  const offline = s.offlineMs + (s.offlineSince !== null ? t - s.offlineSince : 0)
  const cap = (n: number) => Math.min(24 * 3_600_000, Math.max(0, Math.round(n)))
  return {
    presence: { hiddenMs: cap(hidden), offlineMs: cap(offline), visible: typeof document === "undefined" || document.visibilityState !== "hidden" },
    taken: t,
  }
}

/** The server heard us at `taken`: everything before it is explained, start a fresh ledger. */
export function ackPresence(taken: number) {
  const s = ensure()
  s.hiddenMs = 0
  s.offlineMs = 0
  if (s.hiddenSince !== null) s.hiddenSince = Math.max(s.hiddenSince, taken)
  if (s.offlineSince !== null) s.offlineSince = Math.max(s.offlineSince, taken)
}
