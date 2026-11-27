"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

type State = "checking" | "ok" | "degraded" | "offline"

const COPY: Record<State, { label: string; detail: string; dot: string }> = {
  checking: { label: "Checking services", detail: "Contacting the exam server.", dot: "bg-subtle-foreground" },
  ok: { label: "All systems operational", detail: "Exam server and database are answering.", dot: "bg-success text-success animate-live" },
  degraded: {
    label: "Service degraded",
    detail: "The server answered but reported a problem. Candidate answers are still kept on their devices.",
    dot: "bg-warning",
  },
  offline: { label: "You are offline", detail: "This device has no connection. Work resumes when it reconnects.", dot: "bg-danger" },
}

/** Real health of the platform from /api/health and the browser's connection. Polls once a minute. */
export function SystemStatus({ className }: { className?: string }) {
  const [state, setState] = React.useState<State>("checking")
  const [checkedAt, setCheckedAt] = React.useState<string | null>(null)

  React.useEffect(() => {
    let alive = true
    const probe = async () => {
      if (!navigator.onLine) return alive && setState("offline")
      try {
        const r = await fetch("/api/health", { cache: "no-store" })
        if (!alive) return
        setState(r.ok ? "ok" : "degraded")
      } catch {
        if (alive) setState(navigator.onLine ? "degraded" : "offline")
      }
      if (alive) setCheckedAt(new Date().toLocaleTimeString("en-GB", { hour12: false }))
    }
    void probe()
    const t = setInterval(probe, 60_000)
    const off = () => setState("offline")
    window.addEventListener("online", probe)
    window.addEventListener("offline", off)
    return () => {
      alive = false
      clearInterval(t)
      window.removeEventListener("online", probe)
      window.removeEventListener("offline", off)
    }
  }, [])

  const c = COPY[state]
  return (
    <Tooltip>
      <TooltipTrigger
        render={<div className={cn("flex h-8 items-center gap-2 rounded-md px-2 text-xs text-sidebar-foreground/75", className)} role="status" aria-live="polite" />}
      >
        <span className={cn("size-2 shrink-0 rounded-full", c.dot)} aria-hidden />
        <span className="truncate">{c.label}</span>
      </TooltipTrigger>
      <TooltipContent side="right">
        {c.detail}
        {checkedAt && <span className="block opacity-70">Last checked {checkedAt}</span>}
      </TooltipContent>
    </Tooltip>
  )
}
