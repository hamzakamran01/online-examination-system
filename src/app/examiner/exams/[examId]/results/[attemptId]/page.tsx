import Link from "next/link"
import { notFound } from "next/navigation"
import { Check, ChevronLeft, CircleSlash, PenLine, X } from "lucide-react"
import { requirePageRole } from "@/server/auth/guards"
import { getGradingAttempt } from "@/server/services/grading"
import { AppError } from "@/server/errors"
import { fmtDateTime, fmtMarks } from "@/lib/format"
import { cn } from "@/lib/utils"
import { Panel } from "@/components/shell/page-header"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { TypeBadge } from "@/components/shell/status"
import { WrittenGrader } from "@/features/grading/written-grader"

export default async function GradeAttemptPage({ params }: PageProps<"/examiner/exams/[examId]/results/[attemptId]">) {
  const actor = await requirePageRole("examiner")
  const { examId, attemptId } = await params
  const g = await getGradingAttempt(actor, examId, attemptId).catch((e) => {
    if (e instanceof AppError && e.code === "NOT_FOUND") notFound()
    throw e
  })
  const base = `/examiner/exams/${examId}/results`
  const published = Boolean(g.exam.resultsPublishedAt)
  const pending = g.items.filter((i) => i.needsGrading).length
  const final = g.attempt.status !== "in_progress"

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
      <div className="min-w-0 space-y-4">
        <Link href={base} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="size-4" aria-hidden />
          All attempts
        </Link>
        {!final && (
          <p className="rounded-lg border border-info/30 bg-info-soft p-3 text-sm text-info-text">
            This candidate is still writing. You can grade once the attempt is submitted.
          </p>
        )}
        {g.items.map(({ item, index, response, correct, rubric, autoScore, manualScore, feedback, history, needsGrading }) => {
          const selected = response?.kind === "choice" ? response.selected : []
          const text = response?.kind === "text" ? response.text : ""
          const unanswered = item.type === "written" ? !text.trim() : selected.length === 0
          const awarded = item.type === "written" ? (manualScore ?? (final && unanswered ? 0 : null)) : (autoScore ?? (final ? 0 : null))
          return (
            <Panel key={item.itemId} className={cn("p-5", needsGrading && "border-warning/50")} aria-labelledby={`q-${item.itemId}`}>
              <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
                <span className="font-medium text-muted-foreground">Question {index + 1}</span>
                <TypeBadge type={item.type} />
                {item.type === "multi" && <Badge variant="outline">{item.scheme === "partial" ? "Partial credit" : "All or nothing"}</Badge>}
                {unanswered && (
                  <Badge variant="muted">
                    <CircleSlash aria-hidden />
                    Not answered
                  </Badge>
                )}
                <span className="ml-auto font-medium tabular-nums">
                  {awarded === null ? <span className="text-warning-text">Not graded</span> : fmtMarks(awarded)} / {fmtMarks(item.marks)}
                  {item.type !== "written" && <span className="ml-1 text-xs font-normal text-muted-foreground">(auto)</span>}
                </span>
              </div>
              <p id={`q-${item.itemId}`} className="mb-4 font-medium whitespace-pre-wrap">
                {item.stem}
              </p>

              {item.type === "written" ? (
                <div className="space-y-4">
                  <div className="rounded-lg border bg-muted/40 p-4 text-sm whitespace-pre-wrap">
                    {text.trim() ? text : <span className="text-muted-foreground italic">No answer submitted.</span>}
                  </div>
                  {rubric && (
                    <details className="rounded-lg border p-3 text-sm">
                      <summary className="cursor-pointer font-medium">Grading rubric</summary>
                      <p className="mt-2 whitespace-pre-wrap text-muted-foreground">{rubric}</p>
                    </details>
                  )}
                  {final && (
                    <WrittenGrader
                      examId={examId}
                      attemptId={attemptId}
                      itemId={item.itemId}
                      max={item.marks}
                      initialMarks={manualScore}
                      initialFeedback={feedback ?? ""}
                      published={published}
                    />
                  )}
                  {history.length > 0 && (
                    <div className="text-xs text-muted-foreground">
                      <p className="mb-1 font-medium text-foreground">Grading history</p>
                      <ul className="space-y-1">
                        {history.map((h, i) => (
                          <li key={i}>
                            {fmtDateTime(h.at)}: {h.by ?? "Unknown"} set {h.from === null ? "" : `${fmtMarks(h.from)} to `}
                            {fmtMarks(h.to)}
                            {h.reason && <span> (reason: {h.reason})</span>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                <ul className="space-y-2" aria-label="Options">
                  {item.options.map((o, oi) => {
                    const picked = selected.includes(o.id)
                    const isKey = correct.includes(o.id)
                    return (
                      <li
                        key={o.id}
                        className={cn(
                          "flex items-start gap-3 rounded-lg border p-3 text-sm",
                          isKey && "border-success/50 bg-success-soft/40",
                          picked && !isKey && "border-danger/50 bg-danger-soft/40"
                        )}
                      >
                        <span className="mt-0.5 font-medium text-muted-foreground">{String.fromCharCode(65 + oi)}.</span>
                        <span className="flex-1">{o.text}</span>
                        <span className="flex shrink-0 gap-1.5 text-xs">
                          {picked && <Badge variant={isKey ? "success" : "danger"}>Candidate chose</Badge>}
                          {isKey && (
                            <Badge variant="success">
                              <Check aria-hidden />
                              Correct
                            </Badge>
                          )}
                          {picked && !isKey && <X className="size-4 text-danger-text" aria-label="Incorrect choice" />}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              )}
            </Panel>
          )
        })}
      </div>

      <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start" aria-label="Attempt summary">
        <Panel className="space-y-4 p-5">
          <div>
            <p className="text-xs text-muted-foreground">Candidate</p>
            <p className="font-medium">{g.attempt.candidate}</p>
            <p className="text-xs text-muted-foreground">{g.attempt.email}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Submitted</p>
            <p className="text-sm">{fmtDateTime(g.attempt.submittedAt)}</p>
            {g.attempt.submitReason && g.attempt.submitReason !== "candidate" && (
              <p className="text-xs text-muted-foreground">{g.attempt.submitReason === "timeout" ? "Automatically at the time limit" : "When the examiner closed the exam"}</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3 border-t pt-4 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Automatic</p>
              <p className="font-medium tabular-nums">{fmtMarks(g.attempt.scoreAuto)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Manual</p>
              <p className="font-medium tabular-nums">{fmtMarks(g.attempt.scoreManual)}</p>
            </div>
          </div>
          <div className="border-t pt-4">
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="text-2xl font-semibold tabular-nums">
              {fmtMarks(g.attempt.scoreTotal)} <span className="text-base font-normal text-muted-foreground">/ {fmtMarks(g.attempt.maxMarks)}</span>
            </p>
            {g.attempt.gradingStatus === "pending" ? (
              <Badge variant="warning" className="mt-1">
                {pending} written answer{pending === 1 ? "" : "s"} to grade
              </Badge>
            ) : (
              <Badge variant="success" className="mt-1">
                Fully graded
              </Badge>
            )}
          </div>
          {g.nextUngradedId && (
            <Link href={`${base}/${g.nextUngradedId}`} className={buttonVariants({ className: "w-full" })}>
              <PenLine />
              Next attempt to grade
            </Link>
          )}
        </Panel>
        {published && (
          <p className="rounded-lg border border-warning/30 bg-warning-soft p-3 text-xs text-warning-text">
            Results are published. Any change you save is a regrade: it needs a reason, is recorded in the audit log, and replaces previously issued reports.
          </p>
        )}
      </aside>
    </div>
  )
}
