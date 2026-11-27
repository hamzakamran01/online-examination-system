"use client"

import * as React from "react"
import { Clock, WifiOff } from "lucide-react"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

/**
 * The server's clock, shown everywhere. Deadlines are enforced against this
 * time, never the device clock, so the product makes it visible. Counts
 * forward from one server reading with performance.now() (monotonic).
 */
export function ServerClock({ className }: { className?: string }) {
  const [point, setPoint] = React.useState<{ server: number; mono: number } | null>(null)
  const [now, setNow] = React.useState<number | null>(null)
  const [online, setOnline] = React.useState(true)

  React.useEffect(() => {
    let alive = true
    const sync = async () => {
      const t0 = performance.now()
      try {
        const r = await fetch("/api/time", { cache: "no-store" })
        const { now: iso } = (await r.json()) as { now: string }
        if (alive) setPoint({ server: Date.parse(iso) + (performance.now() - t0) / 2, mono: performance.now() })
      } catch {
        /* offline: keep counting from the last reading */
      }
    }
    void sync()
    const resync = setInterval(sync, 60_000)
    const on = () => {
      setOnline(true)
      void sync()
    }
    const off = () => setOnline(false)
    window.addEventListener("online", on)
    window.addEventListener("offline", off)
    queueMicrotask(() => setOnline(navigator.onLine))
    return () => {
      alive = false
      clearInterval(resync)
      window.removeEventListener("online", on)
      window.removeEventListener("offline", off)
    }
  }, [])

  React.useEffect(() => {
    if (!point) return
    // Paint the first reading at once instead of a blank "--:--:--" for a full second.
    queueMicrotask(() => setNow(point.server + (performance.now() - point.mono)))
    const t = setInterval(() => setNow(point.server + (performance.now() - point.mono)), 1000)
    return () => clearInterval(t)
  }, [point])

  const time = now === null ? "--:--:--" : new Date(now).toLocaleTimeString("en-GB", { hour12: false })
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            className={cn(
              "inline-flex h-8 items-center gap-2 rounded-md border bg-surface px-2.5 text-xs text-muted-foreground",
              !online && "border-warning/40 bg-warning-soft text-warning-text",
              className
            )}
          />
        }
      >
        {online ? <Clock className="size-3.5" aria-hidden /> : <WifiOff className="size-3.5" aria-hidden />}
        <span className="hidden sm:inline">{online ? "Server time" : "Offline"}</span>
        <span className="font-mono font-medium text-foreground tabular-nums" suppressHydrationWarning>
          {time}
        </span>
      </TooltipTrigger>
      <TooltipContent>Every timer and deadline uses this server clock, not your device clock.</TooltipContent>
    </Tooltip>
  )
}
