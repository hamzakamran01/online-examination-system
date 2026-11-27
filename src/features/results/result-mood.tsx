"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { fmtMarks } from "@/lib/format"

type Mood = "stellar" | "great" | "good" | "low" | "tough"

/** Mood follows the percentage, and never reads as a pass when the pass mark was missed. */
export function moodFor(percent: number, passed: boolean | null): Mood {
  if (passed === false) return percent >= 35 ? "low" : "tough"
  if (percent >= 85) return "stellar"
  if (percent >= 70) return "great"
  if (percent >= 50) return "good"
  if (percent >= 35) return "low"
  return "tough"
}

const COPY: Record<Mood, { title: string; body: string; tone: string; ring: string; face: string }> = {
  stellar: { title: "Outstanding work", body: "A top result. Your preparation clearly paid off.", tone: "text-success-text", ring: "var(--success)", face: "var(--success)" },
  great: { title: "Great result", body: "Strong performance across the paper. Well done.", tone: "text-success-text", ring: "var(--success)", face: "var(--success)" },
  good: { title: "Solid result", body: "A good base. The breakdown below shows where to gain more marks.", tone: "text-brand-text", ring: "var(--primary)", face: "var(--primary)" },
  low: { title: "Keep going", body: "Not the result you wanted. Use the feedback below to focus your revision.", tone: "text-time-text", ring: "var(--time)", face: "var(--time)" },
  tough: { title: "A tough one", body: "Every exam teaches something. Your examiner's feedback below is the best place to start.", tone: "text-danger-text", ring: "var(--danger)", face: "var(--danger)" },
}

/** Hand-drawn face per mood. Same stroke language as the icon set; animated with CSS only. */
function Face({ mood }: { mood: Mood }) {
  const stroke = { stroke: "currentColor", strokeWidth: 3, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, fill: "none" }
  return (
    <svg viewBox="0 0 64 64" className="size-full" aria-hidden>
      <circle cx="32" cy="32" r="27" fill="currentColor" opacity="0.14" />
      <circle cx="32" cy="32" r="27" {...stroke} />
      {mood === "stellar" && (
        <>
          <path d="m22 21 1.6 3.4 3.7.5-2.7 2.6.7 3.7-3.3-1.8-3.3 1.8.7-3.7-2.7-2.6 3.7-.5z" fill="currentColor" className="mood-twinkle" />
          <path d="m42 21 1.6 3.4 3.7.5-2.7 2.6.7 3.7-3.3-1.8-3.3 1.8.7-3.7-2.7-2.6 3.7-.5z" fill="currentColor" className="mood-twinkle [animation-delay:.3s]" />
          <path d="M19 38c3 8 9 11 13 11s10-3 13-11z" fill="currentColor" />
        </>
      )}
      {mood === "great" && (
        <>
          <path d="M20 27c1.5-3 5.5-3 7 0M37 27c1.5-3 5.5-3 7 0" {...stroke} />
          <path d="M20 37c3 7 8 10 12 10s9-3 12-10" {...stroke} />
        </>
      )}
      {mood === "good" && (
        <>
          <circle cx="24" cy="26" r="2.6" fill="currentColor" />
          <circle cx="40" cy="26" r="2.6" fill="currentColor" />
          <path d="M22 39c3 4 6.5 5.5 10 5.5s7-1.5 10-5.5" {...stroke} />
        </>
      )}
      {mood === "low" && (
        <>
          <circle cx="24" cy="27" r="2.6" fill="currentColor" />
          <circle cx="40" cy="27" r="2.6" fill="currentColor" />
          <path d="M23 43c3-2 6-2.6 9-2.6s6 .6 9 2.6" {...stroke} />
        </>
      )}
      {mood === "tough" && (
        <>
          <path d="M19 24l7 3M45 24l-7 3" {...stroke} />
          <circle cx="24" cy="30" r="2.4" fill="currentColor" />
          <circle cx="40" cy="30" r="2.4" fill="currentColor" />
          <path d="M22 46c3-4 6.5-5.5 10-5.5s7 1.5 10 5.5" {...stroke} />
          <path d="M42 34c0 0-2.5 3.4-2.5 5a2.5 2.5 0 0 0 5 0c0-1.6-2.5-5-2.5-5z" fill="var(--info)" className="mood-tear" />
        </>
      )}
    </svg>
  )
}

function useCountUp(target: number, ms = 900) {
  const [v, setV] = React.useState(0)
  React.useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      queueMicrotask(() => setV(target))
      return
    }
    let raf = 0
    const t0 = performance.now()
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / ms)
      const eased = 1 - Math.pow(1 - p, 3)
      setV(target * eased)
      if (p < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [target, ms])
  return v
}

/**
 * Result hero: a live mood face, an animated score ring and a count-up score.
 * Encouraging copy at every level; colour is backed by text so meaning never depends on colour.
 */
export function ResultMood({
  score,
  max,
  percent,
  passed,
  passMark,
}: {
  score: number
  max: number
  percent: number
  passed: boolean | null
  passMark: number | null
}) {
  const mood = moodFor(percent, passed)
  const c = COPY[mood]
  const shown = useCountUp(score)
  const pct = useCountUp(percent)
  const R = 54
  const C = 2 * Math.PI * R

  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:gap-8">
      <div className="relative size-36 shrink-0">
        <svg viewBox="0 0 128 128" className="size-full -rotate-90" aria-hidden>
          <circle cx="64" cy="64" r={R} fill="none" stroke="var(--muted)" strokeWidth="8" />
          <circle cx="64" cy="64" r={R} fill="none" stroke={c.ring} strokeWidth="8" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - Math.min(100, pct) / 100)} />
        </svg>
        <div className={cn("absolute inset-[22%]", mood === "stellar" || mood === "great" ? "mood-bounce" : mood === "tough" ? "mood-sway" : "mood-breathe")} style={{ color: c.face }}>
          <Face mood={mood} />
        </div>
        {mood === "stellar" && (
          <span className="pointer-events-none absolute inset-0" aria-hidden>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <span key={i} className="mood-spark absolute size-1.5 rounded-full bg-time" style={{ left: "50%", top: "50%", ["--a" as string]: `${i * 60}deg`, animationDelay: `${i * 0.08}s` }} />
            ))}
          </span>
        )}
      </div>

      <div className="text-center sm:text-left">
        <p className={cn("text-sm font-semibold", c.tone)}>{c.title}</p>
        <p className="mt-1 font-display text-5xl leading-none font-semibold tabular-nums">
          {fmtMarks(Math.round(shown * 100) / 100)}
          <span className="ml-1 text-2xl font-medium text-muted-foreground">/ {fmtMarks(max)}</span>
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          <span className="font-medium text-foreground tabular-nums">{Math.round(pct)}%</span>
          {passed !== null && passMark !== null && passMark > 0 && (
            <>
              {" · "}
              <span className={cn("font-medium", passed ? "text-success-text" : "text-danger-text")}>{passed ? "Passed" : "Below the pass mark"}</span> of {fmtMarks(passMark)}
            </>
          )}
        </p>
        <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">{c.body}</p>
        <span className="sr-only">
          {`Result: ${fmtMarks(score)} out of ${fmtMarks(max)}, ${percent} percent. ${c.title}.`}
        </span>
      </div>
    </div>
  )
}
