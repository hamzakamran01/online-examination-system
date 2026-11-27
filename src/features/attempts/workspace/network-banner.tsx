"use client"

import * as React from "react"
import { AlertTriangle, CloudOff, RefreshCw, ServerCrash, TimerOff } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import type { SyncState } from "./sync-engine"

/** Final warning window for answers still on the device (I-5.3, P3.3). */
export const UNSYNCED_WARNING_MS = 2 * 60_000

type Tone = "warning" | "danger" | "info"
type Notice = { tone: Tone; icon: typeof CloudOff; title: string; body: string; retry: boolean }

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/**
 * Network-aware guidance (S-4.1). The sync pill says what is happening in a few
 * words; this banner says what it means and what to do, in plain language, and
 * escalates when unsynced answers meet the end of the exam.
 */
function notice({
  state,
  pending,
  serverReachable,
  remaining,
}: {
  state: SyncState
  pending: number
  serverReachable: boolean
  remaining: number
}): Notice | null {
  if (pending > 0 && remaining > 0 && remaining <= UNSYNCED_WARNING_MS)
    return {
      tone: "danger",
      icon: TimerOff,
      title: `Less than 2 minutes left and ${plural(pending, "answer is", "answers are")} not on the server yet`,
      body: "Reconnect now (check Wi-Fi or move closer to the router). Answers that reach the server after the deadline cannot be counted.",
      retry: state !== "offline",
    }
  if (state === "offline")
    return {
      tone: "warning",
      icon: CloudOff,
      title: "You are offline",
      body: `Keep answering. Every change is kept on this device${pending ? ` (${plural(pending, "answer", "answers")} waiting)` : ""} and is sent automatically when the connection returns. The timer keeps running on the server.`,
      retry: false,
    }
  if (state === "error")
    return {
      tone: "danger",
      icon: AlertTriangle,
      title: "Some answers could not be saved",
      body: "The server rejected a change. Check your most recent answers and select them again.",
      retry: false,
    }
  if (state === "retrying")
    return {
      tone: "warning",
      icon: RefreshCw,
      title: "Weak connection",
      body: `Retrying automatically${pending ? `, ${plural(pending, "answer", "answers")} waiting` : ""}. Keep working; nothing you have entered is lost.`,
      retry: true,
    }
  if (!serverReachable)
    return {
      tone: "info",
      icon: ServerCrash,
      title: "Cannot reach the exam server",
      body: "Answers already saved are safe. Keep working: anything new is kept on this device and sent as soon as the server answers.",
      retry: true,
    }
  return null
}

const TONE: Record<Tone, string> = {
  warning: "border-warning/40 bg-warning-soft text-warning-text",
  danger: "border-danger/40 bg-danger-soft text-danger-text",
  info: "border-info/30 bg-info-soft text-info-text",
}

export function NetworkBanner({
  state,
  pending,
  lastSyncedAt,
  serverReachable,
  remaining,
  locked,
  onRetry,
}: {
  state: SyncState
  pending: number
  lastSyncedAt: number | null
  serverReachable: boolean
  remaining: number
  locked: boolean
  onRetry: () => void
}) {
  // Closing the tab with unsynced answers: the journal keeps them on this device,
  // but the candidate may switch devices, so ask before leaving.
  React.useEffect(() => {
    if (!pending || locked) return
    const guard = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }
    window.addEventListener("beforeunload", guard)
    return () => window.removeEventListener("beforeunload", guard)
  }, [pending, locked])

  const n = locked ? null : notice({ state, pending, serverReachable, remaining })
  if (!n) return null
  const Icon = n.icon
  return (
    <div className="mx-auto mt-4 max-w-[1240px] px-4 sm:px-6">
      <div role={n.tone === "danger" ? "alert" : "status"} className={cn("flex flex-wrap items-start gap-3 rounded-xl border px-4 py-3 text-sm", TONE[n.tone])}>
        <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
        <div className="min-w-0 flex-1 basis-60">
          <p className="font-medium">{n.title}</p>
          <p>{n.body}</p>
          {lastSyncedAt && <p className="mt-1 text-xs opacity-80">Last saved to the server at {new Date(lastSyncedAt).toLocaleTimeString()}.</p>}
        </div>
        {n.retry && (
          <Button size="sm" variant="outline" className="shrink-0 border-current/30 bg-transparent text-current hover:bg-current/10" onClick={onRetry}>
            <RefreshCw />
            Try now
          </Button>
        )}
      </div>
    </div>
  )
}
