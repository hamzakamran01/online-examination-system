import Link from "next/link"
import { Panel, PanelHeader, PageHeader, Stat } from "@/components/shell/page-header"
import { requirePageRole } from "@/server/auth/guards"
import { getPlatformOverview } from "@/server/services/platform"
import { ActivityChart } from "@/features/platform/activity-chart"
import { fmtDateTime } from "@/lib/format"
export const metadata = { title: "Platform overview" }

export default async function Page() {
  const actor = await requirePageRole("admin")
  const { stats, attention, days, audit } = await getPlatformOverview(actor)
  return (
    <>
      <PageHeader eyebrow={<span className="kicker">Administrator desk</span>} title="Platform overview" description="Operational snapshot. Account changes remain in the audit log." />
      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Object.entries(stats).map(([label, value]) => (
            <Stat key={label} label={label} value={value} />
          ))}
        </div>
        <Panel>
          <PanelHeader title="Needs attention" />
          {attention.length ? (
            <ul className="flex list-disc flex-col gap-2 px-9 py-4">
              {attention.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          ) : (
            <p className="p-4 text-muted-foreground">No issues to review.</p>
          )}
        </Panel>
        <Panel>
          <PanelHeader title="Submissions in the past 14 days" />
          <div className="p-3">
            {days.some((day) => day.count) ? (
              <ActivityChart days={days} />
            ) : (
              <p className="text-muted-foreground">No submissions in this period.</p>
            )}
          </div>
          {days.some((day) => day.count) && (
            <details className="px-4 pb-4">
              <summary>Daily submission counts</summary>
              <dl className="mt-2 grid grid-cols-2 gap-1">
                {days.map((day) => (
                  <div key={day.date} className="contents">
                    <dt>{day.date}</dt>
                    <dd>{day.count}</dd>
                  </div>
                ))}
              </dl>
            </details>
          )}
        </Panel>
        <Panel>
          <PanelHeader
            title="Latest audit entries"
            actions={
              <Link href="/admin/audit" className="inline-flex min-h-11 items-center text-sm text-primary underline">
                View audit log
              </Link>
            }
          />
          {audit.length ? (
            <ul className="divide-y">
              {audit.map((row) => (
                <li key={row.id} className="break-words p-4 text-sm">
                  <strong>{row.action}</strong>
                  <p className="text-muted-foreground">
                    {row.actorName ?? "System"} · {fmtDateTime(row.createdAt)}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="p-4 text-muted-foreground">No audit entries yet.</p>
          )}
        </Panel>
      </div>
    </>
  )
}
