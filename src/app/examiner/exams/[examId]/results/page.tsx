import Link from "next/link"
import { CheckCircle2, CircleAlert, ClipboardCheck, PenLine } from "lucide-react"
import { requirePageRole } from "@/server/auth/guards"
import { getResultsOverview } from "@/server/services/grading"
import { fmtDateTime, fmtMarks } from "@/lib/format"
import { Panel, PanelHeader, Stat } from "@/components/shell/page-header"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { PublishResultsButton } from "@/features/grading/publish-results-button"
import { DownloadReportButton } from "@/features/reports/download-button"

export default async function ResultsPage({ params }: PageProps<"/examiner/exams/[examId]/results">) {
  const actor = await requirePageRole("examiner")
  const { examId } = await params
  const r = await getResultsOverview(actor, examId)
  const firstPending = r.attempts.find((a) => a.status !== "in_progress" && a.gradingStatus === "pending")
  const base = `/examiner/exams/${examId}/results`

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Submitted" value={r.summary.finalized} />
        <Stat label="Still writing" value={r.summary.inProgress} tone={r.summary.inProgress ? "info" : undefined} />
        <Stat label="Needs grading" value={r.summary.ungraded} tone={r.summary.ungraded ? "warning" : undefined} />
        <Stat label="Fully graded" value={r.summary.graded} tone={r.summary.graded ? "success" : undefined} />
      </div>

      <Panel>
        <PanelHeader
          title="Publication"
          description={
            r.exam.resultsPublishedAt
              ? `Published ${fmtDateTime(r.exam.resultsPublishedAt)}. Candidates can see their own results. Regrades now require a reason.`
              : "Review every score before candidates see anything. Publishing is one-way."
          }
          actions={
            <>
              {r.summary.finalized > 0 && <DownloadReportButton kind="exam" id={examId} />}
              {firstPending && (
                <Link href={`${base}/${firstPending.id}`} className={buttonVariants({ variant: "outline" })}>
                  <PenLine />
                  Grade next
                </Link>
              )}
              {!r.exam.resultsPublishedAt && <PublishResultsButton examId={examId} disabled={!r.canPublish} count={r.summary.finalized} />}
            </>
          }
        />
        {!r.exam.resultsPublishedAt && (
          <ul className="space-y-2 p-5 text-sm">
            {r.blockers.length ? (
              r.blockers.map((b) => (
                <li key={b} className="flex gap-2 text-warning-text">
                  <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                  {b}
                </li>
              ))
            ) : (
              <li className="flex gap-2 text-success-text">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
                Every attempt is submitted and graded. Results are ready to publish.
              </li>
            )}
          </ul>
        )}
      </Panel>

      <Panel>
        <PanelHeader title={`Attempts (${r.attempts.length})`} description="Sandbox previews are never listed or counted." />
        {r.attempts.length ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-5">Candidate</TableHead>
                  <TableHead>Submission</TableHead>
                  <TableHead>Grading</TableHead>
                  <TableHead className="text-right">Score</TableHead>
                  <TableHead className="pr-5 text-right">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {r.attempts.map((a) => {
                  const final = a.status !== "in_progress"
                  const pct = final && a.scoreTotal !== null && a.maxMarks ? Math.round((100 * a.scoreTotal) / a.maxMarks) : null
                  return (
                    <TableRow key={a.id}>
                      <TableCell className="pl-5">
                        <p className="font-medium">{a.candidate}</p>
                        <p className="text-xs text-muted-foreground">{a.email}</p>
                      </TableCell>
                      <TableCell>
                        {!final ? (
                          <Badge variant="success">Writing now</Badge>
                        ) : (
                          <div className="space-y-0.5">
                            <Badge variant={a.submitReason === "candidate" ? "info" : "muted"}>
                              {a.submitReason === "candidate" ? "Submitted" : a.submitReason === "timeout" ? "Auto-submitted at time limit" : "Closed by examiner"}
                            </Badge>
                            <p className="text-xs text-muted-foreground">{fmtDateTime(a.submittedAt)}</p>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {!final ? (
                          <span className="text-muted-foreground">-</span>
                        ) : a.gradingStatus === "pending" ? (
                          <Badge variant="warning">{a.pendingCount} written to grade</Badge>
                        ) : (
                          <Badge variant="success">Graded</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {final ? (
                          <>
                            <span className="font-medium">
                              {fmtMarks(a.scoreTotal)} / {fmtMarks(a.maxMarks)}
                            </span>
                            {pct !== null && <span className="block text-xs text-muted-foreground">{pct}%{a.gradingStatus === "pending" ? " so far" : ""}</span>}
                          </>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell className="pr-5 text-right">
                        {final && (
                          <Link href={`${base}/${a.id}`} className={buttonVariants({ variant: a.gradingStatus === "pending" ? "default" : "ghost", size: "sm" })}>
                            {a.gradingStatus === "pending" ? "Grade" : "Review"}
                          </Link>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        ) : (
          <Empty className="py-14">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <ClipboardCheck />
              </EmptyMedia>
              <EmptyTitle>No attempts yet</EmptyTitle>
              <EmptyDescription>Submissions appear here as candidates finish. Objective questions are marked automatically.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </Panel>
    </div>
  )
}
