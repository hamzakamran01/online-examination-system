import Link from "next/link"
import { ArrowUpRight, type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

/*
 * Dashboard kit. Role homes open with a compact command header (date, who,
 * the live situation in one line, actions) followed by KPI cards that each
 * drill into the screen that explains them. No full-bleed banners.
 */

const TZ = process.env.APP_TIMEZONE ?? "Asia/Karachi"

export function todayLabel(now: Date) {
  return new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: TZ }).format(now)
}

export type Pulse = "live" | "ok" | "attention" | "idle"
const PULSE: Record<Pulse, string> = {
  live: "bg-success text-success animate-live",
  ok: "bg-success",
  attention: "bg-time",
  idle: "bg-subtle-foreground",
}

export function DashHeader({
  eyebrow,
  title,
  status,
  pulse = "idle",
  actions,
}: {
  eyebrow: React.ReactNode
  title: React.ReactNode
  status?: React.ReactNode
  pulse?: Pulse
  actions?: React.ReactNode
}) {
  return (
    <header className="mb-5 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        <p className="eyebrow text-muted-foreground">{eyebrow}</p>
        <h1 className="font-display mt-1.5 text-[1.7rem] leading-tight font-semibold tracking-tight sm:text-[2rem]">{title}</h1>
        {status && (
          <p className="mt-2 flex items-start gap-2 text-[0.94rem] text-muted-foreground">
            <span className={cn("mt-[0.45rem] size-2 shrink-0 rounded-full", PULSE[pulse])} aria-hidden />
            <span>{status}</span>
          </p>
        )}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}

/** Minimal sparkline: a stroked trend with a soft area. Values are drawn as given, never smoothed. */
export function Sparkline({ values, className, label }: { values: number[]; className?: string; label?: string }) {
  if (values.length < 2) return null
  const w = 120
  const h = 24
  const max = Math.max(1, ...values)
  const step = w / (values.length - 1)
  const pts = values.map((v, i) => [i * step, h - 2 - (v / max) * (h - 6)] as const)
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join("")
  const last = pts[pts.length - 1]
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className={cn("h-6 w-full overflow-visible", className)} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <path d={`${line}L${w} ${h}L0 ${h}Z`} fill="currentColor" opacity="0.1" />
      <path d={line} fill="none" stroke="currentColor" strokeWidth="1.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      <circle cx={last[0]} cy={last[1]} r="2.5" fill="currentColor" />
    </svg>
  )
}

export type Tone = "brand" | "success" | "time" | "danger" | "info" | "neutral"
const TONE: Record<Tone, { chip: string; text: string; bar: string }> = {
  brand: { chip: "bg-brand-soft text-brand-text", text: "text-brand-text", bar: "bg-primary" },
  success: { chip: "bg-success-soft text-success-text", text: "text-success-text", bar: "bg-success" },
  time: { chip: "bg-time-soft text-time-text", text: "text-time-text", bar: "bg-time" },
  danger: { chip: "bg-danger-soft text-danger-text", text: "text-danger-text", bar: "bg-danger" },
  info: { chip: "bg-info-soft text-info-text", text: "text-info-text", bar: "bg-info" },
  neutral: { chip: "bg-muted text-muted-foreground", text: "text-muted-foreground", bar: "bg-border-strong" },
}

export type Kpi = {
  label: string
  value: React.ReactNode
  hint?: React.ReactNode
  icon?: LucideIcon
  tone?: Tone
  href?: string
  spark?: number[]
  /** Optional 0..100 meter under the value. */
  meter?: number
  live?: boolean
}

export function KpiCard({ k }: { k: Kpi }) {
  const t = TONE[k.tone ?? "brand"]
  const Icon = k.icon
  const body = (
    <>
      <span className={cn("absolute inset-x-0 top-0 h-0.5 opacity-80", t.bar)} aria-hidden />
      <div className="flex items-start justify-between gap-3">
        <p className="eyebrow min-w-0 text-[0.65rem] leading-tight tracking-[0.06em] text-muted-foreground">
          {k.live && <span className="size-1.5 animate-live rounded-full bg-success text-success" aria-hidden />}
          {k.label}
        </p>
        {Icon && (
          <span className={cn("grid size-6 shrink-0 place-items-center rounded-md", t.chip)} aria-hidden>
            <Icon className="size-3.5" />
          </span>
        )}
      </div>
      <p className="font-display mt-1 text-[1.8rem] leading-none font-semibold tracking-tight tabular-nums">{k.value}</p>
      {k.meter !== undefined && (
        <span className="mt-2 block h-1 overflow-hidden rounded-full bg-muted" aria-hidden>
          <span className={cn("block h-full rounded-full", t.bar)} style={{ width: `${Math.min(100, Math.max(0, k.meter))}%` }} />
        </span>
      )}
      {k.spark && <Sparkline values={k.spark} className={cn("mt-2", t.text)} />}
      <div className="mt-auto flex items-center justify-between gap-2 pt-2.5 text-xs leading-snug text-muted-foreground">
        <span className="line-clamp-2 min-w-0">{k.hint}</span>
        {k.href && <ArrowUpRight className="size-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" aria-hidden />}
      </div>
    </>
  )
  const cls = "group relative flex min-h-[124px] flex-col overflow-hidden rounded-xl border bg-surface p-3.5 shadow-panel sm:p-4"
  return k.href ? (
    <Link href={k.href} className={cn(cls, "transition-[border-color,box-shadow,transform] hover:-translate-y-px hover:border-border-strong hover:shadow-raised")}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  )
}

export function KpiGrid({ items, className }: { items: Kpi[]; className?: string }) {
  return (
    <div className={cn("mb-5 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4", className)}>
      {items.map((k) => (
        <KpiCard key={k.label} k={k} />
      ))}
    </div>
  )
}

/** Standard dashboard panel heading row with an optional drill-in link. */
export function CardTitle({ icon: Icon, title, meta, href, linkLabel = "View all" }: { icon?: LucideIcon; title: string; meta?: React.ReactNode; href?: string; linkLabel?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b px-5 py-3">
      <h2 className="flex min-w-0 items-center gap-2 text-[0.95rem] font-semibold">
        {Icon && <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />}
        <span className="truncate">{title}</span>
        {meta !== undefined && <span className="rounded-full bg-muted px-1.5 text-xs font-medium text-muted-foreground tabular-nums">{meta}</span>}
      </h2>
      {href && (
        <Link href={href} className="inline-flex shrink-0 items-center gap-1 rounded text-xs font-medium text-brand-text hover:underline">
          {linkLabel}
          <ArrowUpRight className="size-3.5" aria-hidden />
        </Link>
      )}
    </div>
  )
}
