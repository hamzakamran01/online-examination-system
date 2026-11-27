"use client"

/**
 * Workspace runtime (C-3.6.1, C-3.6.2, C-3.6.3, I-5.3).
 *
 * - Heartbeat every 15 s: tells the server the candidate is present, pulls
 *   server time, the current deadline (extensions move it), announcements and
 *   granted extensions.
 * - Signals (tab away >= 1 s, full screen exit, offline period) are queued in
 *   localStorage and delivered with the next heartbeat, so they survive outages
 *   and refreshes. Durations use the monotonic clock. Signals never block or
 *   end the attempt.
 */
import * as React from "react"
import { toast } from "sonner"
import { HEARTBEAT_MS, MIN_TAB_AWAY_MS } from "@/lib/domain/monitoring"
import type { ClientSignal } from "@/lib/validation/monitoring"
import { getClientId } from "./sync-engine"

export type Announcement = { id: string; body: string; createdAt: string }

const read = <T,>(key: string, fallback: T): T => {
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}
const write = (key: string, value: unknown) => {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* storage blocked: in-memory state still works */
  }
}

const fmtAdded = (sec: number) => {
  const m = Math.round(sec / 60)
  return m >= 1 ? `${m} minute${m === 1 ? "" : "s"}` : `${sec} seconds`
}

export function useAttemptRuntime({
  attemptId,
  initialAnnouncements,
  locked,
  onServerTime,
  onFinalized,
}: {
  attemptId: string
  initialAnnouncements: Announcement[]
  locked: boolean
  onServerTime: (serverNow: number, deadline: number) => void
  onFinalized: () => void
}) {
  const [announcements, setAnnouncements] = React.useState<Announcement[]>(initialAnnouncements)
  const [dismissed, setDismissed] = React.useState<string[]>([])
  const [serverReachable, setServerReachable] = React.useState(true)
  const keys = React.useMemo(
    () => ({ signals: `ev:signals:${attemptId}`, seenExt: `ev:ext:${attemptId}`, dismissed: `ev:ann:${attemptId}` }),
    [attemptId]
  )
  const queue = React.useRef<ClientSignal[]>([])
  const inflight = React.useRef(false)
  const stopped = React.useRef(false)
  const knownAnn = React.useRef(new Set(initialAnnouncements.map((a) => a.id)))
  const cb = React.useRef({ onServerTime, onFinalized })
  React.useEffect(() => {
    cb.current = { onServerTime, onFinalized }
  })

  const enqueue = React.useCallback(
    (s: ClientSignal) => {
      queue.current = [...queue.current, s].slice(-50)
      write(keys.signals, queue.current)
    },
    [keys]
  )

  const beat = React.useCallback(async () => {
    if (stopped.current || inflight.current) return
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setServerReachable(false)
      return
    }
    inflight.current = true
    const sending = queue.current
    const t0 = performance.now()
    try {
      const res = await fetch(`/api/attempts/${attemptId}/heartbeat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: getClientId(), signals: sending }),
        cache: "no-store",
      })
      if (res.status === 401 || res.status === 404) {
        stopped.current = true
        return
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const hb = (await res.json()) as {
        status: string
        serverNow: string
        deadlineAt: string
        announcements: Announcement[]
        extensions: { id: string; seconds: number }[]
      }
      setServerReachable(true)
      // Delivered: drop exactly what was sent, keep anything queued meanwhile.
      queue.current = queue.current.slice(sending.length)
      write(keys.signals, queue.current)
      cb.current.onServerTime(Date.parse(hb.serverNow) + (performance.now() - t0) / 2, Date.parse(hb.deadlineAt))

      const fresh = hb.announcements.filter((a) => !knownAnn.current.has(a.id))
      if (fresh.length) {
        fresh.forEach((a) => knownAnn.current.add(a.id))
        toast.info("New announcement from your examiner", { description: fresh[0].body, duration: 10_000 })
      }
      setAnnouncements(hb.announcements)

      const seen = new Set(read<string[]>(keys.seenExt, []))
      const newExt = hb.extensions.filter((x) => !seen.has(x.id))
      if (newExt.length) {
        const total = newExt.reduce((s, x) => s + x.seconds, 0)
        toast.success(`Your examiner added ${fmtAdded(total)} to your time.`, { description: "The timer already shows your new time.", duration: 12_000 })
        write(keys.seenExt, hb.extensions.map((x) => x.id))
      }

      if (hb.status !== "in_progress") {
        stopped.current = true
        cb.current.onFinalized()
      }
    } catch {
      setServerReachable(false)
    } finally {
      inflight.current = false
    }
  }, [attemptId, keys])

  React.useEffect(() => {
    queue.current = read<ClientSignal[]>(keys.signals, [])
    // Dismissed announcements stay dismissed after a refresh on this device.
    queueMicrotask(() => setDismissed(read<string[]>(keys.dismissed, [])))

    let hiddenAt: number | null = document.visibilityState === "hidden" ? performance.now() : null
    let offlineAt: number | null = navigator.onLine ? null : performance.now()
    let wasFullscreen = !!document.fullscreenElement

    const onVisibility = () => {
      if (document.visibilityState === "hidden") hiddenAt = performance.now()
      else if (hiddenAt !== null) {
        const durationMs = Math.round(performance.now() - hiddenAt)
        hiddenAt = null
        if (durationMs >= MIN_TAB_AWAY_MS) enqueue({ type: "tab_hidden", durationMs, at: Date.now() })
        void beat()
      }
    }
    const onFullscreen = () => {
      const now = !!document.fullscreenElement
      if (wasFullscreen && !now) enqueue({ type: "fullscreen_exit", at: Date.now() })
      wasFullscreen = now
    }
    const onOffline = () => {
      offlineAt = performance.now()
      setServerReachable(false)
    }
    const onOnline = () => {
      if (offlineAt !== null) enqueue({ type: "offline", durationMs: Math.round(performance.now() - offlineAt), at: Date.now() })
      offlineAt = null
      enqueue({ type: "reconnect", at: Date.now() })
      void beat()
    }

    document.addEventListener("visibilitychange", onVisibility)
    document.addEventListener("fullscreenchange", onFullscreen)
    window.addEventListener("offline", onOffline)
    window.addEventListener("online", onOnline)
    const first = setTimeout(() => void beat(), 0)
    const t = setInterval(() => void beat(), HEARTBEAT_MS)
    return () => {
      clearTimeout(first)
      clearInterval(t)
      document.removeEventListener("visibilitychange", onVisibility)
      document.removeEventListener("fullscreenchange", onFullscreen)
      window.removeEventListener("offline", onOffline)
      window.removeEventListener("online", onOnline)
    }
  }, [beat, enqueue, keys])

  React.useEffect(() => {
    if (locked) stopped.current = true
  }, [locked])

  const dismiss = React.useCallback(
    (id: string) => {
      setDismissed((d) => {
        const next = [...new Set([...d, id])]
        write(keys.dismissed, next)
        return next
      })
    },
    [keys]
  )

  const visible = announcements.filter((a) => !dismissed.includes(a.id))
  return { announcements, visible, dismiss, serverReachable, beatNow: beat }
}
