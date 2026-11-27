import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Page title block. Status or context goes in `eyebrow` (information), never a
 * decorative kicker. The title uses the display face; everything else is UI type.
 */
export function PageHeader({
  title,
  description,
  actions,
  back,
  eyebrow,
  className,
}: {
  title: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
  back?: { href: string; label: string }
  /** Informational status shown before the title (for example a lifecycle badge). */
  eyebrow?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("mb-8 flex flex-col gap-4", className)}>
      {back && (
        <Link
          href={back.href}
          className="inline-flex w-fit items-center gap-1.5 rounded-md text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
          {back.label}
        </Link>
      )}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="flex min-w-0 flex-col gap-2">
          {eyebrow && <div className="flex flex-wrap items-center gap-2">{eyebrow}</div>}
          <h1 className="font-display text-[1.65rem] leading-tight font-semibold sm:text-[1.9rem]">{title}</h1>
          {description && <div className="max-w-[68ch] text-[0.94rem] leading-relaxed text-muted-foreground">{description}</div>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  )
}

/** Flat surface: hairline border, no shadow. Never nest panels. */
export function Panel({ className, ...props }: React.ComponentProps<"section">) {
  return <section className={cn("rounded-xl border bg-surface", className)} {...props} />
}

export function PanelHeader({
  title,
  description,
  actions,
  className,
}: {
  title: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex flex-col gap-3 border-b px-5 py-4 sm:flex-row sm:items-center sm:justify-between", className)}>
      <div className="min-w-0">
        <h2 className="text-[0.95rem] font-semibold">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

/** A joined row of metrics separated by hairlines: one object, not a wall of cards. */
export function MetricStrip({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border lg:grid-cols-4", className)}>{children}</div>
}

const TONE = {
  success: "text-success-text",
  warning: "text-warning-text",
  info: "text-info-text",
  danger: "text-danger-text",
  time: "text-time-text",
} as const

export function Stat({
  label,
  value,
  hint,
  tone,
  className,
}: {
  label: string
  value: React.ReactNode
  hint?: React.ReactNode
  tone?: keyof typeof TONE
  className?: string
}) {
  return (
    <div className={cn("flex flex-col gap-1.5 bg-surface px-5 py-4", className)}>
      <p className="text-[0.8rem] text-muted-foreground">{label}</p>
      <p className={cn("font-display text-[1.7rem] leading-none font-semibold tabular-nums", tone && TONE[tone])}>{value}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

/** Section title inside a page, outside panels. */
export function SectionTitle({ children, hint, action }: { children: React.ReactNode; hint?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <div className="flex min-w-0 items-baseline gap-2">
        <h2 className="text-base font-semibold">{children}</h2>
        {hint && <span className="truncate text-sm text-muted-foreground">{hint}</span>}
      </div>
      {action}
    </div>
  )
}
