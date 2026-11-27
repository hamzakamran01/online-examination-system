import Link from "next/link"
import { AlertTriangle, BarChart3, CheckCircle2, History, Inbox, Layers, PenLine, Radio, UserPlus, Users } from "lucide-react"
import { Panel } from "@/components/shell/page-header"
import { greeting } from "@/components/shell/hero"
import { CardTitle, DashHeader, KpiGrid, todayLabel } from "@/components/shell/dashboard"
import { ContourLines } from "@/components/shell/decor"
import { buttonVariants } from "@/components/ui/button"
import { requirePageRole } from "@/server/auth/guards"
import { getPlatformOverview } from "@/server/services/platform"
import { ActivityChart } from "@/features/platform/activity-chart"
import { fmtDateTime } from "@/lib/format"
import { cn } from "@/lib/utils"

export const metadata = { title: "Platform overview" }

const describe = (action: string) => {
  const s = action.replace(/[._]/g, " ")
  return s.charAt(0).toUpperCase() + s.slice(1)
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter((p) => /^[A-Za-z]/.test(p) && !/^(Dr|Mr|Ms|Mrs|Prof)\.?$/i.test(p))
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()

/** Segmented composition bar with a linked legend. Every colour is paired with a label and count. */
function Composition({ parts, label }: { parts: { key: string; label: string; n: number; bar: string; href?: string }[]; label: string }) {
  const total = parts.reduce((n, p) => n + p.n, 0)
  return (
    <div className="p-5">
      <div className="flex items-baseline justify-between">
        <p className="font-display text-3xl font-semibold tabular-nums">{total}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
      <div className="mt-3 flex h-2.5 gap-0.5 overflow-hidden rounded-full" role="img" aria-label={parts.map((p) => `${p.n} ${p.label}`).join(", ")}>
        {total ? parts.filter((p) => p.n).map((p) => <span key={p.key} className={cn("h-full", p.bar)} style={{ flexGrow: p.n }} />) : <span className="h-full flex-1 bg-muted" />}
      </div>
      <ul className="mt-4 grid grid-cols-2 gap-1">
        {parts.map((p) => {
          const inner = (
            <>
              <span className={cn("size-2.5 shrink-0 rounded-sm", p.bar)} aria-hidden />
              <span className="flex-1 truncate">{p.label}</span>
              <span className="font-medium tabular-nums">{p.n}</span>
            </>
          )
          return (
            <li key={p.key}>
              {p.href ? (
                <Link href={p.href} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors hover:bg-muted sm:text-sm">
                  {inner}
                </Link>
              ) : (
                <span className="flex items-center gap-2 px-2 py-1.5 text-xs sm:text-sm">{inner}</span>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export default async function Page() {
  const actor = await requirePageRole("admin")
  const { stats, attention, days, audit } = await getPlatformOverview(actor)
  const s = stats as Record<string, number>
  const total14 = days.reduce((n, d) => n + d.count, 0)
  const now = new Date()
  const writing = s["Candidates writing"]

  return (
    <>
      <DashHeader
        eyebrow={`${todayLabel(now)} · Platform administration`}
        title={`${greeting(now)}, ${actor.name.split(" ")[0]}`}
        status={
          attention.length
            ? `${attention.length} item${attention.length === 1 ? " needs" : "s need"} an administrator. ${writing} candidate${writing === 1 ? " is" : "s are"} writing right now.`
            : `Everything is running normally. ${writing} candidate${writing === 1 ? " is" : "s are"} writing right now.`
        }
        pulse={attention.length ? "attention" : writing ? "live" : "ok"}
        actions={
          <>
            <Link href="/admin/audit" className={buttonVariants({ variant: "outline", size: "lg" })}>
              <History />
              Audit log
            </Link>
            <Link href="/admin?new=1" className={buttonVariants({ size: "lg" })}>
              <UserPlus />
              Create account
            </Link>
          </>
        }
      />

      <KpiGrid
        items={[
          { label: "Writing now", value: writing, hint: "Active attempts, all exams", icon: Radio, tone: "success", live: writing > 0 },
          { label: "Submitted today", value: s["Submitted today"], hint: `${total14} in 14 days, sandbox excluded`, icon: Inbox, tone: "brand", spark: days.map((d) => d.count) },
          { label: "Answers to grade", value: s["Written answers awaiting grading"], hint: "Across all examiners", icon: PenLine, tone: "time" },
          {
            label: "Needs attention",
            value: attention.length,
            hint: attention.length ? "See the queue below" : "Nothing open",
            icon: attention.length ? AlertTriangle : CheckCircle2,
            tone: attention.length ? "danger" : "success",
          },
        ]}
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <Panel className="overflow-hidden">
          <CardTitle icon={Users} title="People" href="/admin" linkLabel="Manage" />
          <Composition
            label="accounts"
            parts={[
              { key: "c", label: "Candidates", n: s["Active candidates"], bar: "bg-primary", href: "/admin" },
              { key: "e", label: "Examiners", n: s["Active examiners"], bar: "bg-info", href: "/admin" },
              { key: "a", label: "Administrators", n: s["Active administrators"], bar: "bg-chart-2", href: "/admin" },
              { key: "d", label: "Deactivated", n: s["Deactivated accounts"], bar: "bg-border-strong", href: "/admin" },
            ]}
          />
        </Panel>

        <Panel className="overflow-hidden">
          <CardTitle icon={Layers} title="Examinations" />
          <Composition
            label="by lifecycle stage"
            parts={[
              { key: "o", label: "Ongoing", n: s["Ongoing exams"], bar: "bg-success" },
              { key: "s", label: "Scheduled", n: s["Scheduled exams"], bar: "bg-info" },
              { key: "d", label: "Drafts", n: s["Draft exams"], bar: "bg-border-strong" },
              { key: "c", label: "Completed", n: s["Completed exams"], bar: "bg-primary" },
            ]}
          />
        </Panel>

        <Panel className="overflow-hidden">
          <CardTitle icon={AlertTriangle} title="Needs attention" meta={attention.length} />
          {attention.length ? (
            <ul className="divide-y">
              {attention.map((item, i) => (
                <li key={i} className="flex gap-3 px-5 py-3 text-sm">
                  <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-md bg-time-soft text-time-text" aria-hidden>
                    <AlertTriangle className="size-3.5" />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          ) : (
            <div className="relative isolate overflow-hidden px-5 py-10 text-center">
              <ContourLines lines={10} className="absolute inset-0 -z-10 size-full text-success-text/[0.1]" />
              <CheckCircle2 className="mx-auto size-6 text-success-text" aria-hidden />
              <p className="mt-2 text-sm font-medium">Nothing needs you</p>
              <p className="text-xs text-muted-foreground">Every exam is staffed, graded and running normally.</p>
            </div>
          )}
        </Panel>
      </div>

      <div className="mt-5 grid items-start gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Panel className="overflow-hidden">
          <CardTitle icon={BarChart3} title="Submissions, last 14 days" meta={total14} />
          <div className="p-4">{total14 ? <ActivityChart days={days} /> : <p className="py-10 text-center text-sm text-muted-foreground">No submissions in this period.</p>}</div>
        </Panel>

        <Panel className="overflow-hidden">
          <CardTitle icon={History} title="Audit trail" href="/admin/audit" linkLabel="Full log" />
          {audit.length ? (
            <ol className="relative px-5 py-4">
              <span className="absolute top-6 bottom-6 left-[2.15rem] w-px bg-border" aria-hidden />
              {audit.slice(0, 6).map((row) => (
                <li key={row.id} className="relative flex items-start gap-3 py-2 text-sm">
                  <span className="relative grid size-7 shrink-0 place-items-center rounded-full border bg-surface text-[0.6rem] font-semibold text-muted-foreground shadow-xs" aria-hidden>
                    {initials(row.actorName ?? "System") || "SY"}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{describe(row.action)}</span>
                    <span className="text-xs text-muted-foreground">
                      {row.actorName ?? "System"} · <time className="tabular-nums">{fmtDateTime(row.createdAt)}</time>
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="px-5 py-6 text-sm text-muted-foreground">No audit entries yet.</p>
          )}
        </Panel>
      </div>
    </>
  )
}
