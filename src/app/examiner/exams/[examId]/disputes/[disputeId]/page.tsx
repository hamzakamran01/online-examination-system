import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Check, ChevronLeft, CircleSlash, FileSearch, Users } from "lucide-react"
import { requirePageRole } from "@/server/auth/guards"
import { getDisputeEvidence } from "@/server/services/disputes"
import { AppError } from "@/server/errors"
import { fmtDateTime, fmtMarks } from "@/lib/format"
import { cn } from "@/lib/utils"
import { DISPUTE_STATUS_LABEL, DISPUTE_TYPE_LABEL } from "@/lib/domain/disputes"
import { Panel, PanelHeader } from "@/components/shell/page-header"
import { Badge } from "@/components/ui/badge"
import { TypeBadge } from "@/components/shell/status"
import { EvidencePanel } from "@/features/grading/evidence-panel"
import { ResolveForm } from "@/features/disputes/resolve-form"

export const metadata: Metadata = { title: "Dispute evidence" }

export default async function DisputeEvidencePage({ params }: PageProps<"/examiner/exams/[examId]/disputes/[disputeId]">) {
  const actor = await requirePageRole("examiner")
  const { examId, disputeId } = await params
  const p = await getDisputeEvidence(actor, examId, disputeId).catch((e) => {
    if (e instanceof AppError && e.code === "NOT_FOUND") notFound()
    throw e
  })
  const { question: q, dispute: d } = p
  const selected = q.response?.kind === "choice" ? q.response.selected : []
  const text = q.response?.kind === "text" ? q.response.text : ""
  const relatedTotal = Object.values(p.related).reduce((s, n) => s + n, 0)

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="min-w-0 space-y-4">
        <Link
          href={`/examiner/exams/${examId}/disputes`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" aria-hidden />
          All disputes
        </Link>

        <Panel>
          <PanelHeader
            title={`${p.candidate.name}: ${DISPUTE_TYPE_LABEL[d.type]}`}
            description={`Raised ${fmtDateTime(d.createdAt)} about question ${q.position} of their paper.`}
            actions={
              <Badge variant={d.status === "open" ? "warning" : d.status === "rejected" ? "secondary" : d.status === "withdrawn" ? "muted" : "success"}>
                {DISPUTE_STATUS_LABEL[d.status]}
              </Badge>
            }
          />
          <blockquote className="m-5 border-l-2 pl-4 text-sm whitespace-pre-wrap">{d.statement}</blockquote>
        </Panel>

        <Panel aria-labelledby="as-seen">
          <PanelHeader
            title={
              <span id="as-seen" className="inline-flex items-center gap-2">
                <FileSearch className="size-4" aria-hidden />
                The question exactly as this candidate saw it
              </span>
            }
            description="From the paper frozen when they started: same wording, same option order, same marks."
          />
          <div className="space-y-4 p-5">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-medium text-muted-foreground">Question {q.position}</span>
              <TypeBadge type={q.item.type} />
              {q.item.type === "multi" && <Badge variant="outline">{q.item.scheme === "partial" ? "Partial credit" : "All or nothing"}</Badge>}
              {q.voided && <Badge variant="warning">Voided for everyone</Badge>}
              {q.overridden && <Badge variant="outline">Mark changed after a dispute</Badge>}
              <span className="ml-auto font-medium tabular-nums">
                {q.voided === "exclude" ? "Not counted" : `${q.awarded === null ? "Not graded" : fmtMarks(q.awarded)} / ${fmtMarks(q.item.marks)}`}
              </span>
            </div>
            <p className="font-medium whitespace-pre-wrap">{q.item.stem}</p>
            {q.item.type === "written" ? (
              <>
                <div className="rounded-lg border bg-muted/40 p-4 text-sm whitespace-pre-wrap">
                  {text.trim() ? text : <span className="text-muted-foreground italic">No answer submitted.</span>}
                </div>
                {q.rubric && (
                  <div className="rounded-lg border p-3 text-sm">
                    <p className="font-medium">Marking guide</p>
                    <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{q.rubric}</p>
                  </div>
                )}
              </>
            ) : (
              <ul className="space-y-2" aria-label="Options with cohort choices">
                {q.item.options.map((o, i) => {
                  const picked = selected.includes(o.id)
                  const isKey = q.correct.includes(o.id)
                  const picks = p.cohort.options.find((c) => c.id === o.id)?.picks ?? 0
                  const pct = p.cohort.candidates ? Math.round((100 * picks) / p.cohort.candidates) : 0
                  return (
                    <li
                      key={o.id}
                      className={cn(
                        "relative overflow-hidden rounded-lg border p-3 text-sm",
                        isKey && "border-success/50",
                        picked && !isKey && "border-danger/50"
                      )}
                    >
                      <span className="absolute inset-y-0 left-0 bg-muted/60" style={{ width: `${pct}%` }} aria-hidden />
                      <span className="relative flex items-start gap-3">
                        <span className="font-medium text-muted-foreground">{String.fromCharCode(65 + i)}.</span>
                        <span className="flex-1">{o.text}</span>
                        <span className="flex shrink-0 flex-wrap justify-end gap-1.5 text-xs">
                          {picked && <Badge variant={isKey ? "success" : "danger"}>Candidate chose</Badge>}
                          {isKey && (
                            <Badge variant="success">
                              <Check aria-hidden />
                              Key
                            </Badge>
                          )}
                          <span className="tabular-nums text-muted-foreground">
                            {picks} chose ({pct}%)
                          </span>
                        </span>
                      </span>
                    </li>
                  )
                })}
                {!selected.length && (
                  <li className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CircleSlash className="size-4" aria-hidden />
                    The candidate selected no option.
                  </li>
                )}
              </ul>
            )}
            {q.savedAt && <p className="text-xs text-muted-foreground">Answer last saved by the server at {fmtDateTime(q.savedAt)}.</p>}
            {q.feedback && <p className="rounded-lg border p-3 text-sm">Feedback given: {q.feedback}</p>}
          </div>
        </Panel>

        <Panel>
          <PanelHeader title="Grading history" description="Every mark set for this answer, by whom, and why." />
          {p.history.length ? (
            <ul className="space-y-1.5 p-5 text-sm">
              {p.history.map((h, i) => (
                <li key={i}>
                  {fmtDateTime(h.at)}: {h.by ?? "Unknown"} {h.action === "grade.regraded" ? "regraded" : "set"} {h.from === null ? "" : `${fmtMarks(h.from)} to `}
                  {fmtMarks(h.to)}
                  {h.reason && <span className="text-muted-foreground"> (reason: {h.reason})</span>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="p-5 text-sm text-muted-foreground">
              {q.item.type === "written" ? "No manual grading recorded." : "Marked automatically from the frozen answer key. No manual changes."}
            </p>
          )}
        </Panel>

        {d.status !== "open" && (
          <Panel className="p-5">
            <p className="text-sm font-medium">Decision</p>
            <p className="text-xs text-muted-foreground">
              {d.resolvedAt ? fmtDateTime(d.resolvedAt) : ""} {d.resolvedBy ? `by ${d.resolvedBy}` : ""}
            </p>
            {d.marksBefore !== null && d.marksAfter !== null && d.marksBefore !== d.marksAfter && (
              <p className="mt-2 text-sm tabular-nums">
                Marks: {fmtMarks(d.marksBefore)} to {fmtMarks(d.marksAfter)}
              </p>
            )}
            {d.resolutionNote && <p className="mt-2 text-sm whitespace-pre-wrap">{d.resolutionNote}</p>}
          </Panel>
        )}
      </div>

      <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start" aria-label="Evidence and decision">
        <Panel className="space-y-3 p-5">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Users className="size-4 text-muted-foreground" aria-hidden />
            How everyone did on this question
          </p>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">Average score</dt>
              <dd className="font-semibold tabular-nums">{p.cohort.facility === null ? "-" : `${p.cohort.facility}%`}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Answered</dt>
              <dd className="font-semibold tabular-nums">
                {p.cohort.answered} / {p.cohort.candidates}
              </dd>
            </div>
          </dl>
          <p className="text-xs text-muted-foreground">
            {relatedTotal
              ? `${relatedTotal} other candidate${relatedTotal === 1 ? " has" : "s have"} disputed this question.`
              : "No other candidate has disputed this question."}
          </p>
        </Panel>

        <EvidencePanel evidence={p.evidence} title="Exam record for this candidate" />

        {p.canAct ? (
          <Panel className="p-5">
            <p className="mb-4 text-sm font-semibold">Your decision</p>
            <ResolveForm examId={examId} disputeId={d.id} max={q.item.marks} current={q.awarded} cohort={p.cohort.candidates} />
          </Panel>
        ) : (
          d.status === "open" && <p className="text-sm text-muted-foreground">Only the exam owner can decide this dispute.</p>
        )}
      </aside>
    </div>
  )
}
