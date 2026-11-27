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

const COPY: Record<Mood, { title: string; body: string; tone: string; ring: string }> = {
  stellar: { title: "Outstanding work", body: "A top result. Your preparation clearly paid off.", tone: "text-success-text", ring: "var(--success)" },
  great: { title: "Great result", body: "Strong performance across the paper. Well done.", tone: "text-success-text", ring: "var(--success)" },
  good: { title: "Solid result", body: "A good base. The breakdown below shows where to gain more marks.", tone: "text-brand-text", ring: "var(--primary)" },
  low: { title: "Keep going", body: "Not the result you wanted. Use the feedback below to focus your revision.", tone: "text-time-text", ring: "var(--time)" },
  tough: { title: "A tough one", body: "Every exam teaches something. Your examiner's feedback below is the best place to start.", tone: "text-danger-text", ring: "var(--danger)" },
}

/**
 * Real emoji, animated: Google Noto Animated Emoji (CC BY 4.0), served from
 * Google's fonts CDN. Reduced-motion users get the static vector version, and a
 * native emoji character is the fallback if the CDN is unreachable.
 */
const EMOJI: Record<Mood, { code: string; label: string }> = {
  stellar: { code: "1f929", label: "Star-struck face" },
  great: { code: "1f604", label: "Grinning face" },
  good: { code: "1f642", label: "Smiling face" },
  low: { code: "1f615", label: "Unsure face" },
  tough: { code: "1f622", label: "Crying face" },
}

function AnimatedEmoji({ mood }: { mood: Mood }) {
  const e = EMOJI[mood]
  const base = `https://fonts.gstatic.com/s/e/notoemoji/latest/${e.code}`
  const [failed, setFailed] = React.useState(false)
  if (failed)
    return (
      <span role="img" aria-label={e.label} className="grid size-full place-items-center text-6xl leading-none">
        {String.fromCodePoint(parseInt(e.code, 16))}
      </span>
    )
  return (
    <picture>
      <source srcSet={`${base}/emoji.svg`} media="(prefers-reduced-motion: reduce)" type="image/svg+xml" />
      <source srcSet={`${base}/512.webp`} type="image/webp" />
      <img
        src={`${base}/512.gif`}
        alt={e.label}
        width={112}
        height={112}
        decoding="async"
        onError={() => setFailed(true)}
        className="size-full object-contain drop-shadow-[0_8px_12px_rgb(0_0_0/0.2)]"
      />
    </picture>
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
      setV(target * (1 - Math.pow(1 - p, 3)))
      if (p < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [target, ms])
  return v
}

/**
 * Result hero: a live animated emoji inside a score ring, beside a count-up
 * score. Encouraging copy at every level; colour is always backed by text.
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
  const R = 58
  const C = 2 * Math.PI * R

  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:gap-8">
      <div className="relative size-40 shrink-0">
        <svg viewBox="0 0 128 128" className="size-full -rotate-90" aria-hidden>
          <circle cx="64" cy="64" r={R} fill="none" stroke="var(--muted)" strokeWidth="6" />
          <circle
            cx="64"
            cy="64"
            r={R}
            fill="none"
            stroke={c.ring}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={C * (1 - Math.min(100, pct) / 100)}
          />
        </svg>
        <div className="absolute inset-[16%]">
          <AnimatedEmoji mood={mood} />
        </div>
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
              <span className={cn("font-medium", passed ? "text-success-text" : "text-danger-text")}>{passed ? "Passed" : "Below the pass mark"}</span> of{" "}
              {fmtMarks(passMark)}
            </>
          )}
        </p>
        <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">{c.body}</p>
        <span className="sr-only">{`Result: ${fmtMarks(score)} out of ${fmtMarks(max)}, ${percent} percent. ${c.title}.`}</span>
      </div>
    </div>
  )
}
