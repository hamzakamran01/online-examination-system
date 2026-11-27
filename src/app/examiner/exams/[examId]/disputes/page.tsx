import type { Metadata } from "next"
import Link from "next/link"
import { ChevronRight, Flame, Scale } from "lucide-react"
import { requirePageRole } from "@/server/auth/guards"
import { listExamDisputes } from "@/server/services/disputes"
import { fmtDateTime } from "@/lib/format"
import { cn } from "@/lib/utils"
import { DISPUTE_STATUS_LABEL, DISPUTE_TYPE_LABEL, DISPUTE_WINDOW_DAYS, HOTSPOT_MIN_DISPUTES } from "@/lib/domain/disputes"
import { MetricStrip, Panel, PanelHeader, Stat } from "@/components/shell/page-header"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"

export const metadata: Metadata = { title: "Disputes" }

export default async function DisputesPage({ params }: PageProps<"/examiner/exams/[examId]/disputes">) {
  const actor = await requirePageRole("examiner")
  const { examId } = await params
  const r = await listExamDisputes(actor, examId)
  const base = `/examiner/exams/${examId}/disputes`
  const hot = r.questions.filter((q) => q.hotspot)

  return (
    <div className="space-y-6">
      <MetricStrip>
        <Stat label="Waiting for a decision" value={r.summary.open} tone={r.summary.open ? "warning" : undefined} />
        <Stat label="Decided" value={r.summary.resolved} />
        <Stat label="Upheld" value={r.summary.upheld} tone={r.summary.upheld ? "success" : undefined} hint="Regraded or voided" />
        <Stat
          label="Dispute window"
          value={r.window.open ? "Open" : r.exam.resultsPublishedAt ? "Closed" : "Not yet"}
          hint={
            r.window.closesAt
              ? `${r.window.open ? "Closes" : "Closed"} ${fmtDateTime(r.window.closesAt)}`
              : `Opens for ${DISPUTE_WINDOW_DAYS} days when results are published`
          }
        />
      </MetricStrip>

      {hot.length > 0 && (
        <Panel className="border-warning/40">
          <PanelHeader
            title={
              <span className="inline-flex items-center gap-2">
                <Flame className="size-4 text-warning-text" aria-hidden />
                Questions attracting disputes
              </span>
            }
            description={`Flagged once ${HOTSPOT_MIN_DISPUTES} or more candidates dispute the same question. Many disputes on one question usually mean the wording or the answer key needs a second look, and voiding applies one rule to everyone.`}
          />
          <ul className="divide-y">
            {hot.map((q) => (
              <li key={q.itemId} className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center">
                <p className="line-clamp-2 flex-1 text-sm">{q.stem}</p>
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  <Badge variant="warning">
                    {q.total} dispute{q.total === 1 ? "" : "s"} ({Math.round(q.rate * 100)}% of papers)
                  </Badge>
                  {Object.entries(q.types).map(([t, n]) => (
                    <Badge key={t} variant="outline">
                      {DISPUTE_TYPE_LABEL[t as keyof typeof DISPUTE_TYPE_LABEL]}: {n}
                    </Badge>
                  ))}
                  {q.voided && <Badge variant="success">Voided</Badge>}
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <Panel>
        <PanelHeader
          title="All disputes"
          description="Open disputes first. Each one opens an evidence pack: the question as the candidate saw it, their answer, the marking guide, the exam record and how everyone else did."
        />
        {r.disputes.length === 0 ? (
          <Empty className="py-12">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Scale />
              </EmptyMedia>
              <EmptyTitle>No disputes</EmptyTitle>
              <EmptyDescription>
                {r.exam.resultsPublishedAt
                  ? "Candidates can question a mark from their result page while the window is open. Disputes appear here."
                  : "After you publish results, candidates can question a mark for a limited time. Disputes appear here."}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Disputes table">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-5">Candidate</TableHead>
                  <TableHead>Question</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Raised</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="pr-5">
                    <span className="sr-only">Open</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {r.disputes.map((d) => (
                  <TableRow key={d.id} className={cn(d.status === "open" && "bg-warning-soft/30")}>
                    <TableCell className="pl-5">
                      <p className="font-medium">{d.candidate}</p>
                      <p className="text-xs text-muted-foreground">{d.email}</p>
                    </TableCell>
                    <TableCell className="max-w-72">
                      <p className="text-xs text-muted-foreground">Question {d.position} on their paper</p>
                      <p className="line-clamp-1 text-sm">{d.stem}</p>
                    </TableCell>
                    <TableCell className="text-sm">{DISPUTE_TYPE_LABEL[d.type]}</TableCell>
                    <TableCell className="text-sm whitespace-nowrap">{fmtDateTime(d.createdAt)}</TableCell>
                    <TableCell>
                      <Badge variant={d.status === "open" ? "warning" : d.status === "withdrawn" ? "muted" : d.status === "rejected" ? "secondary" : "success"}>
                        {DISPUTE_STATUS_LABEL[d.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="pr-5 text-right">
                      <Link
                        href={`${base}/${d.id}`}
                        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm font-medium text-primary hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                        aria-label={`${d.status === "open" ? "Review" : "View"} dispute from ${d.candidate}`}
                      >
                        {d.status === "open" ? "Review" : "View"}
                        <ChevronRight className="size-4" aria-hidden />
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Panel>
    </div>
  )
}
