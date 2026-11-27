"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

const two = (n: number) => String(n).padStart(2, "0")

/**
 * Countdown to a server-provided moment, anchored on one /api/time reading and
 * advanced with performance.now(), so the device clock cannot skew it. Refreshes
 * the page when the moment arrives (the exam becomes startable).
 */
export function Countdown({ to, className }: { to: string; className?: string }) {
  const router = useRouter()
  const target = Date.parse(to)
  const [left, setLeft] = React.useState<number | null>(null)

  React.useEffect(() => {
    let point = { server: Date.now(), mono: performance.now() }
    let done = false
    fetch("/api/time", { cache: "no-store" })
      .then((r) => r.json())
      .then(({ now }: { now: string }) => {
        point = { server: Date.parse(now), mono: performance.now() }
      })
      .catch(() => {})
    const tick = () => {
      const ms = target - (point.server + (performance.now() - point.mono))
      setLeft(ms)
      if (ms <= 0 && !done) {
        done = true
        router.refresh()
      }
    }
    const t = setInterval(tick, 1000)
    queueMicrotask(tick)
    return () => clearInterval(t)
  }, [target, router])

  if (left === null) return <span className={className}>--:--:--</span>
  const s = Math.max(0, Math.floor(left / 1000))
  const d = Math.floor(s / 86400)
  const text = d > 0 ? `${d}d ${two(Math.floor((s % 86400) / 3600))}h ${two(Math.floor((s % 3600) / 60))}m` : `${two(Math.floor(s / 3600))}:${two(Math.floor((s % 3600) / 60))}:${two(s % 60)}`
  return (
    <span className={className} role="timer" aria-label={`Opens in ${text}`}>
      {text}
    </span>
  )
}
