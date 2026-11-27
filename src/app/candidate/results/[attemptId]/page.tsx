import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Check, Clock, Lock, MessageSquare, Scale, X } from "lucide-react"
import { requirePageRole } from "@/server/auth/guards"
import { getCandidateResult } from "@/server/services/grading"
import { getCandidateDisputes } from "@/server/services/disputes"
import { AppError } from "@/server/errors"
import { fmtDateTime, fmtMarks } from "@/lib/format"
import { cn } from "@/lib/utils"
import { PageHeader, Panel } from "@/components/shell/page-header"
import { Badge } from "@/components/ui/badge"
import { DownloadReportButton } from "@/features/reports/download-button"
import { ResultMood } from "@/features/results/result-mood"
import { DisputeThread, RaiseDisputeButton } from "@/features/disputes/candidate-dispute"

export const metadata: Metadata = { title: "My result" }

export default async function CandidateResultPage({ params }: PageProps<"/candidate/results/[attemptId]">) {
  const actor = await requirePageRole("candidate")
  const { attemptId } = await params
  const r = await getCandidateResult(actor, attemptId).catch((e) => {
    if (e instanceof AppError && e.code === "NOT_FOUND") notFound()
    throw e
  })
  const disputes = r.published ? await getCandidateDisputes(actor, attemptId) : null
  const disputeByItem = new Map(disputes?.disputes.map((d) => [d.itemId, d]) ?? [])
  const canRaise = !!disputes?.window.open && disputes.remaining > 0

  return (
    <div className="max-w-3xl">
      <PageHeader
        back={{ href: "/candidate/results", label: "Results" }}
        title={r.exam.title}
        description={`Submitted ${fmtDateTime(r.attempt.submittedAt)}${r.attempt.submitReason === "timeout" ? " (automatically at the time limit)" : ""}`}
      />

      {r.published ? (
        <Panel className="mb-6 overflow-hidden">
          <div className="p-6 sm:p-8">
            <ResultMood score={r.score ?? 0} max={r.attempt.maxMarks} percent={r.percent ?? 0} passed={r.passed} passMark={r.exam.passMark} />
          </div>
          <div className="flex flex-col gap-3 border-t bg-surface-sunken px-6 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-8">
            <p className="text-sm text-muted-foreground">Download a verifiable PDF of this result. Anyone can check it with the code or QR it carries.</p>
            <DownloadReportButton kind="attempt" id={r.attempt.id} />
          </div>
        </Panel>
      ) : (
        <Panel className="mb-6 flex gap-3 p-5">
          <Lock className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
          <div className="text-sm">
            <p className="font-medium">Results not published yet</p>
            <p className="text-muted-foreground">
              Your answers below are exactly what was recorded. Marks and feedback appear here once your examiner reviews and publishes results.
            </p>
          </div>
        </Panel>
      )}

      {disputes && (
        <Panel className="mb-6 flex gap-3 p-5">
          <Scale className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
          <div className="text-sm">
            <p className="font-medium">Something not right?</p>
            <p className="text-muted-foreground">
              {disputes.window.open
                ? `You can question the mark of any question until ${fmtDateTime(disputes.window.closesAt)}. Your examiner sees the question exactly as you saw it, your answer, the marking guide and the exam record, and must explain the decision. ${disputes.remaining} of ${disputes.max} disputes left.`
                : `The window for disputes closed on ${fmtDateTime(disputes.window.closesAt)}.`}
            </p>
            {disputes.disputes.length > 0 && (
              <p className="mt-1 text-muted-foreground">
                {disputes.disputes.filter((d) => d.status === "open").length} under review,{" "}
                {disputes.disputes.filter((d) => d.status !== "open" && d.status !== "withdrawn").length} decided.
              </p>
            )}
          </div>
        </Panel>
      )}

      <h2 className="mb-3 font-semibold">{r.published ? "Question breakdown" : "Your submitted answers"}</h2>
      <ol className="space-y-3">
        {r.items.map((it) => {
          const selected = it.response?.kind === "choice" ? it.response.selected : []
          const text = it.response?.kind === "text" ? it.response.text : ""
          const dispute = disputeByItem.get(it.itemId)
          return (
            <li key={it.itemId}>
              <Panel className="p-5">
                <div className="mb-2 flex items-start justify-between gap-3">
                  <p className="text-sm font-medium text-muted-foreground">Question {it.index + 1}</p>
                  <span className="shrink-0 text-sm tabular-nums">
                    {it.marks === null ? (
                      <span className="inline-flex items-center gap-1 text-muted-foreground">
                        <Clock className="size-3.5" aria-hidden />
                        {fmtMarks(it.maxMarks)} marks
                      </span>
                    ) : it.voided === "exclude" ? (
                      <span className="text-muted-foreground">Voided, not counted</span>
                    ) : (
                      <span className="font-medium">
                        {fmtMarks(it.marks)} / {fmtMarks(it.maxMarks)}
                      </span>
                    )}
                  </span>
                </div>
                <p className="mb-3 whitespace-pre-wrap">{it.stem}</p>
                {it.type === "written" ? (
                  <div className="rounded-lg bg-muted/50 p-3 text-sm whitespace-pre-wrap">{text.trim() ? text : <span className="text-muted-foreground italic">No answer.</span>}</div>
                ) : (
                  <ul className="space-y-1.5 text-sm">
                    {it.options.map((o, oi) => {
                      const picked = selected.includes(o.id)
                      const isKey = it.correct?.includes(o.id) ?? false
                      return (
                        <li
                          key={o.id}
                          className={cn(
                            "flex items-start gap-2 rounded-md border px-3 py-2",
                            picked && "border-primary/50 bg-brand-softer",
                            it.correct && isKey && "border-success/50 bg-success-soft/40",
                            it.correct && picked && !isKey && "border-danger/50 bg-danger-soft/40"
                          )}
                        >
                          <span className="font-medium text-muted-foreground">{String.fromCharCode(65 + oi)}.</span>
                          <span className="flex-1">{o.text}</span>
                          {picked && <Badge variant="outline">Your answer</Badge>}
                          {it.correct && isKey && <Check className="size-4 text-success-text" aria-label="Correct option" />}
                          {it.correct && picked && !isKey && <X className="size-4 text-danger-text" aria-label="Incorrect" />}
                        </li>
                      )
                    })}
                    {!selected.length && <li className="text-muted-foreground italic">No option selected.</li>}
                  </ul>
                )}
                {it.voided && (
                  <p className="mt-3 rounded-lg border border-info/30 bg-info-soft p-3 text-sm text-info-text">
                    {it.voided === "exclude"
                      ? "This question was voided for every candidate and removed from the total marks."
                      : "This question was voided for every candidate and everyone received full marks for it."}
                  </p>
                )}
                {it.feedback && (
                  <p className="mt-3 flex gap-2 rounded-lg border border-info/30 bg-info-soft p-3 text-sm text-info-text">
                    <MessageSquare className="mt-0.5 size-4 shrink-0" aria-hidden />
                    {it.feedback}
                  </p>
                )}
                {dispute ? (
                  <DisputeThread attemptId={r.attempt.id} d={dispute} />
                ) : (
                  canRaise &&
                  !it.voided && (
                    <div className="mt-3 flex justify-end">
                      <RaiseDisputeButton attemptId={r.attempt.id} itemId={it.itemId} questionNo={it.index + 1} />
                    </div>
                  )
                )}
              </Panel>
            </li>
          )
        })}
      </ol>
      {r.published && !r.revealAnswers && (
        <p className="mt-4 text-xs text-muted-foreground">Correct answers are not shown for this exam, by the examiner&apos;s choice.</p>
      )}
    </div>
  )
}
