import Link from "next/link"
import { AlertTriangle, ArrowUpRight, CheckCircle2, History, Users } from "lucide-react"
import { Panel, PanelHeader, Stat, MetricStrip, SectionTitle } from "@/components/shell/page-header"
import { HeroBand, greeting, heroPrimary, heroSecondary } from "@/components/shell/hero"
import { requirePageRole } from "@/server/auth/guards"
import { getPlatformOverview } from "@/server/services/platform"
import { ActivityChart } from "@/features/platform/activity-chart"
import { fmtDateTime } from "@/lib/format"

export const metadata = { title: "Platform overview" }

const describe = (action: string) => {
  const s = action.replace(/[._]/g, " ")
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export default async function Page() {
  const actor = await requirePageRole("admin")
  const { stats, attention, days, audit } = await getPlatformOverview(actor)
  const s = stats as Record<string, number>
  const total14 = days.reduce((n, d) => n + d.count, 0)

  return (
    <>
      <HeroBand
        kicker={`${greeting(new Date())}, ${actor.name.split(" ")[0]}`}
        title="Platform overview"
        summary={
          attention.length
            ? `${attention.length} item${attention.length === 1 ? " needs" : "s need"} an administrator. ${s["Candidates writing"]} candidate${s["Candidates writing"] === 1 ? " is" : "s are"} writing right now.`
            : `Everything is running normally. ${s["Candidates writing"]} candidate${s["Candidates writing"] === 1 ? " is" : "s are"} writing right now.`
        }
        actions={
          <>
            <Link href="/admin" className={heroPrimary}>
              <Users />
              Manage users
            </Link>
            <Link href="/admin/audit" className={heroSecondary}>
              <History />
              Audit log
            </Link>
          </>
        }
        metrics={[
          { label: "Writing now", value: s["Candidates writing"], hint: "Active attempts" },
          { label: "Submitted today", value: s["Submitted today"], hint: "Sandbox excluded" },
          { label: "Answers to grade", value: s["Written answers awaiting grading"], hint: "Across all examiners" },
          { label: "Needs attention", value: attention.length, hint: attention.length ? "See list below" : "Nothing open" },
        ]}
      />

      <div className="flex flex-col gap-8">
        <div className="grid gap-8 lg:grid-cols-2">
          <section aria-label="People">
            <SectionTitle
              hint="Active accounts"
              action={
                <Link href="/admin" className="text-sm font-medium text-brand-text hover:underline">
                  Manage users
                </Link>
              }
            >
              People
            </SectionTitle>
            <MetricStrip className="lg:grid-cols-2">
              <Stat label="Candidates" value={s["Active candidates"]} />
              <Stat label="Examiners" value={s["Active examiners"]} />
              <Stat label="Administrators" value={s["Active administrators"]} />
              <Stat label="Deactivated" value={s["Deactivated accounts"]} tone={s["Deactivated accounts"] ? "warning" : undefined} />
            </MetricStrip>
          </section>
          <section aria-label="Examinations">
            <SectionTitle hint="By lifecycle stage">Examinations</SectionTitle>
            <MetricStrip className="lg:grid-cols-2">
              <Stat label="Ongoing" value={s["Ongoing exams"]} tone={s["Ongoing exams"] ? "success" : undefined} />
              <Stat label="Scheduled" value={s["Scheduled exams"]} />
              <Stat label="Drafts" value={s["Draft exams"]} />
              <Stat label="Completed" value={s["Completed exams"]} />
            </MetricStrip>
          </section>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <Panel>
            <PanelHeader title="Submissions, last 14 days" description={`${total14} submitted attempt${total14 === 1 ? "" : "s"}. Sandbox previews excluded.`} />
            <div className="p-4">
              {total14 ? <ActivityChart days={days} /> : <p className="py-10 text-center text-sm text-muted-foreground">No submissions in this period.</p>}
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Needs attention" description={attention.length ? `${attention.length} item${attention.length === 1 ? "" : "s"}` : "Nothing to review"} />
            {attention.length ? (
              <ul className="divide-y">
                {attention.map((item, i) => (
                  <li key={i} className="flex gap-3 px-5 py-3 text-sm">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0 text-time-text" aria-hidden />
                    {item}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="flex items-center gap-2 px-5 py-6 text-sm text-muted-foreground">
                <CheckCircle2 className="size-4 text-success-text" aria-hidden />
                Every exam is staffed, graded and running normally.
              </p>
            )}
          </Panel>
        </div>

        <Panel>
          <PanelHeader
            title="Latest audit entries"
            actions={
              <Link href="/admin/audit" className="inline-flex items-center gap-1 text-sm font-medium text-brand-text hover:underline">
                Full audit log
                <ArrowUpRight className="size-3.5" aria-hidden />
              </Link>
            }
          />
          {audit.length ? (
            <ol className="divide-y">
              {audit.map((row) => (
                <li key={row.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                  <History className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="font-medium">{describe(row.action)}</span>
                    <span className="text-muted-foreground"> by {row.actorName ?? "System"}</span>
                  </span>
                  <time className="shrink-0 text-xs text-muted-foreground tabular-nums">{fmtDateTime(row.createdAt)}</time>
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
