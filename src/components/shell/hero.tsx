import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { DashHeader, KpiGrid, todayLabel, type Kpi, type Pulse } from "./dashboard"

/** Greeting from the server clock in the event timezone, so it never depends on the device. */
export function greeting(now: Date) {
  const h = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: process.env.APP_TIMEZONE ?? "Asia/Karachi" }).format(now))
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening"
}

/**
 * Page opener for summary screens: a compact command header followed by KPI
 * cards. Kept under its old name so existing screens adopt the new layout.
 */
export function HeroBand({
  kicker,
  title,
  summary,
  actions,
  metrics,
  pulse,
  className,
}: {
  kicker?: React.ReactNode
  title: React.ReactNode
  summary?: React.ReactNode
  actions?: React.ReactNode
  metrics?: Kpi[]
  pulse?: Pulse
  className?: string
}) {
  return (
    <div className={className}>
      <DashHeader eyebrow={kicker ?? todayLabel(new Date())} title={title} status={summary} pulse={pulse} actions={actions} />
      {metrics && metrics.length > 0 && <KpiGrid items={metrics} />}
    </div>
  )
}

export const heroPrimary = cn(buttonVariants({ size: "lg" }), "h-10 px-4")
export const heroSecondary = cn(buttonVariants({ variant: "outline", size: "lg" }), "h-10 px-4")
