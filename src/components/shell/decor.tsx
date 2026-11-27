import { useId } from "react"
import { cn } from "@/lib/utils"

/*
 * Decoration drawn from the exam itself: OMR answer-sheet bubbles, flowing
 * contour lines, the server-clock dial, and certificate print (rope border,
 * microprint, seal) instead of generic gradient blobs. Everything here is decorative: aria-hidden,
 * pointer-events none, and drawn in currentColor so it follows the theme.
 */

const mask = (url: string, size = "contain", repeat = "no-repeat"): React.CSSProperties => ({
  WebkitMaskImage: `url(${url})`,
  maskImage: `url(${url})`,
  WebkitMaskSize: size,
  maskSize: size,
  WebkitMaskRepeat: repeat,
  maskRepeat: repeat,
  WebkitMaskPosition: "center",
  maskPosition: "center",
  backgroundColor: "currentColor",
})

/** Repeating wave band, as on the edge of a certificate. */
export function GuillocheBand({ className }: { className?: string }) {
  return <div aria-hidden className={cn("pointer-events-none h-3", className)} style={mask("/decor/guilloche-wave.svg", "auto 100%", "repeat-x")} />
}

/** Line of microprint. Text is repeated to fill; it is never read aloud. */
export function Microprint({ text = "EXAMVAULT SECURE EXAMINATION RECORD", className }: { text?: string; className?: string }) {
  const line = Array.from({ length: 12 }, () => text).join("  ·  ")
  return (
    <div aria-hidden className={cn("microprint pointer-events-none", className)}>
      {line}
    </div>
  )
}

/** Circular seal with ringed microtext, used for verified and official marks. */
export function Seal({ className, label = "VERIFIED RECORD · EXAMVAULT · " }: { className?: string; label?: string }) {
  const id = "seal" + useId().replace(/[^a-zA-Z0-9_-]/g, "")
  return (
    <svg viewBox="0 0 120 120" aria-hidden className={cn("pointer-events-none", className)} fill="none" stroke="currentColor">
      <defs>
        <path id={id} d="M60 60 m-44 0 a44 44 0 1 1 88 0 a44 44 0 1 1 -88 0" />
      </defs>
      <circle cx="60" cy="60" r="57" strokeWidth="1.25" />
      <circle cx="60" cy="60" r="53" strokeWidth="0.6" strokeDasharray="1.5 2.5" />
      <circle cx="60" cy="60" r="35" strokeWidth="1" />
      <text fill="currentColor" stroke="none" fontSize="8.2" fontFamily="var(--font-mono)" letterSpacing="2.2">
        <textPath href={`#${id}`}>{label.repeat(2)}</textPath>
      </text>
      <path d="m46 61 9 9 19-20" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/**
 * The layered background of the work sheet: blueprint grid fading out from the
 * top, a soft brand light and a paper grain. Sits behind page content.
 */
export function SheetBackdrop({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn("pointer-events-none absolute inset-x-0 top-0 -z-0 h-[420px] overflow-hidden", className)}>
      <div className="bg-glow absolute inset-0" />
      <div className="bg-grid absolute inset-0" />
    </div>
  )
}

/** Deterministic PRNG so server and client render identical decoration. */
function rng(seed: number) {
  let t = seed >>> 0
  return () => {
    t = (t + 0x6d2b79f5) >>> 0
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * OMR answer-sheet field: rows of A to E bubbles grouped in columns, one bubble
 * marked per row, exactly like a machine-read exam sheet. `marked` colours the
 * filled bubbles (defaults to currentColor).
 */
export function BubbleField({
  rows = 8,
  groups = 3,
  seed = 7,
  className,
  markedClassName,
}: {
  rows?: number
  groups?: number
  seed?: number
  className?: string
  markedClassName?: string
}) {
  const r = rng(seed)
  const gap = 13
  const groupGap = 22
  const cols = 5
  const w = groups * cols * gap + (groups - 1) * groupGap
  const h = rows * gap
  const cells: React.ReactNode[] = []
  for (let g = 0; g < groups; g++) {
    for (let row = 0; row < rows; row++) {
      const pick = Math.floor(r() * cols)
      const blank = r() < 0.12
      for (let c = 0; c < cols; c++) {
        const x = g * (cols * gap + groupGap) + c * gap + gap / 2
        const y = row * gap + gap / 2
        const on = !blank && c === pick
        cells.push(
          <circle key={`${g}-${row}-${c}`} cx={x} cy={y} r={4} className={on ? markedClassName : undefined} fill={on ? "currentColor" : "none"} stroke="currentColor" strokeWidth={on ? 0 : 0.9} opacity={on ? 1 : 0.55} />
        )
      }
    }
  }
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} aria-hidden className={cn("pointer-events-none", className)}>
      {cells}
    </svg>
  )
}

/** Flowing contour lines, like the isolines on a survey map. Sized by className. */
export function ContourLines({ lines = 14, seed = 3, className }: { lines?: number; seed?: number; className?: string }) {
  const r = rng(seed)
  const a = 18 + r() * 10
  const b = 10 + r() * 8
  const paths = Array.from({ length: lines }, (_, i) => {
    const y = 20 + i * (260 / lines)
    const k = i / lines
    const d = [
      `M-20 ${y.toFixed(1)}`,
      `C120 ${(y - a * (1 - k)).toFixed(1)} 200 ${(y + b + a * k).toFixed(1)} 320 ${(y - b * k).toFixed(1)}`,
      `S520 ${(y - a + b * k).toFixed(1)} 640 ${(y + a * 0.4).toFixed(1)}`,
    ].join(" ")
    return <path key={i} d={d} strokeWidth={i % 4 === 0 ? 1.1 : 0.7} opacity={i % 4 === 0 ? 0.9 : 0.55} />
  })
  return (
    <svg viewBox="0 0 620 300" preserveAspectRatio="none" aria-hidden className={cn("pointer-events-none", className)} fill="none" stroke="currentColor">
      {paths}
    </svg>
  )
}

/**
 * Server-clock dial: 60 minute ticks with an arc showing real progress
 * (0 to 1), for example how much of an exam window has elapsed.
 */
export function ClockDial({ progress, className, arcClassName }: { progress?: number; className?: string; arcClassName?: string }) {
  const R = 44
  const C = 2 * Math.PI * R
  const p = progress === undefined ? undefined : Math.min(1, Math.max(0, progress))
  return (
    <svg viewBox="0 0 120 120" aria-hidden className={cn("pointer-events-none", className)} fill="none" stroke="currentColor">
      {Array.from({ length: 60 }, (_, i) => {
        const t = (i / 60) * Math.PI * 2
        const major = i % 5 === 0
        const r1 = major ? 50 : 52.5
        return (
          <line
            key={i}
            x1={60 + Math.sin(t) * r1}
            y1={60 - Math.cos(t) * r1}
            x2={60 + Math.sin(t) * 56}
            y2={60 - Math.cos(t) * 56}
            strokeWidth={major ? 1.6 : 0.8}
            opacity={major ? 0.9 : 0.5}
          />
        )
      })}
      <circle cx="60" cy="60" r={R} strokeWidth="5" opacity="0.14" />
      {p !== undefined && (
        <circle cx="60" cy="60" r={R} strokeWidth="5" strokeLinecap="round" strokeDasharray={`${C * p} ${C}`} transform="rotate(-90 60 60)" className={arcClassName} />
      )}
    </svg>
  )
}
