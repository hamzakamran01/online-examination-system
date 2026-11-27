import { cn } from "@/lib/utils"

/** Greeting from the server clock in the event timezone, so it never depends on the device. */
export function greeting(now: Date) {
  const h = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: process.env.APP_TIMEZONE ?? "Asia/Karachi" }).format(now))
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening"
}

/**
 * Solid brand band at the top of each role home: who you are, the live
 * situation in one sentence, and the primary actions. Metrics sit inside it as
 * a divided row, so the band reads as one object.
 */
export function HeroBand({
  kicker,
  title,
  summary,
  actions,
  metrics,
  className,
}: {
  kicker?: React.ReactNode
  title: React.ReactNode
  summary?: React.ReactNode
  actions?: React.ReactNode
  metrics?: { label: string; value: React.ReactNode; hint?: React.ReactNode }[]
  className?: string
}) {
  return (
    <section className={cn("surface-brand relative mb-8 overflow-hidden rounded-xl", className)}>
      <div className="bg-dots pointer-events-none absolute inset-0" aria-hidden />
      <div className="relative flex flex-col gap-6 p-6 sm:p-8 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          {kicker && <p className="text-sm text-muted-foreground">{kicker}</p>}
          <h1 className="font-display mt-1 text-[1.9rem] leading-tight font-semibold sm:text-[2.2rem]">{title}</h1>
          {summary && <p className="mt-2 max-w-2xl text-[0.95rem] leading-relaxed text-muted-foreground">{summary}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
      </div>
      {metrics && metrics.length > 0 && (
        <dl className="relative grid grid-cols-2 border-t border-white/15 sm:grid-cols-4">
          {metrics.map((m, i) => (
            <div key={m.label} className={cn("px-6 py-4 sm:px-8", i > 0 && "sm:border-l sm:border-white/15", i % 2 === 1 && "border-l border-white/15 sm:border-l", i >= 2 && "border-t border-white/15 sm:border-t-0")}>
              <dt className="text-xs text-muted-foreground">{m.label}</dt>
              <dd className="font-display mt-1 text-[1.75rem] leading-none font-semibold tabular-nums">{m.value}</dd>
              {m.hint && <dd className="mt-1 text-xs text-muted-foreground">{m.hint}</dd>}
            </div>
          ))}
        </dl>
      )}
    </section>
  )
}

/** Light button for use on the brand band. */
export const heroPrimary =
  "inline-flex h-10 items-center gap-2 rounded-lg bg-white px-4 text-sm font-semibold text-[oklch(0.3_0.06_192)] transition-colors hover:bg-white/90 [&_svg]:size-4"
export const heroSecondary =
  "inline-flex h-10 items-center gap-2 rounded-lg border border-white/25 px-4 text-sm font-medium text-white transition-colors hover:bg-white/10 [&_svg]:size-4"
