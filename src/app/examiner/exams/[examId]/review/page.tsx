import Link from "next/link"
import { AlertTriangle, CheckCircle2, CircleAlert, Info } from "lucide-react"
import { requirePageRole } from "@/server/auth/guards"
import { getReadiness } from "@/server/services/exams"
import { listSandboxAttempts } from "@/server/services/attempts"
import { effectiveStatus } from "@/lib/domain/exam-status"
import { fmtDateTime, fmtDuration, fmtMarks } from "@/lib/format"
import { Panel, PanelHeader } from "@/components/shell/page-header"
import { DifficultyBadge, TypeBadge } from "@/components/shell/status"
import { PublishButton } from "@/features/exams/publish-button"
import { cn } from "@/lib/utils"

export default async function ReviewPage({ params }: PageProps<"/examiner/exams/[examId]/review">) {
  const actor = await requirePageRole("examiner")
  const { examId } = await params
  const [r, sandbox] = await Promise.all([getReadiness(actor, examId), listSandboxAttempts(actor, examId)])
  const status = effectiveStatus(r.exam)
  const blockers = r.checks.filter((c) => c.blocking && !c.ok).length

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="space-y-6">
        <Panel>
          <PanelHeader title="Exam summary" description="This is what enrolled candidates will receive." />
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 p-5 text-sm sm:grid-cols-3">
            {[
              ["Opens", fmtDateTime(r.exam.startsAt)],
              ["Closes", fmtDateTime(r.exam.endsAt)],
              ["Duration", fmtDuration(r.exam.durationMin)],
              ["Total marks", fmtMarks(r.exam.totalMarks)],
              ["Pass mark", r.exam.passMark === null ? "Not set" : fmtMarks(r.exam.passMark)],
              ["Enrolled", String(r.enrolled)],
              ["Question order", r.exam.shuffleQuestions ? "Shuffled per candidate" : "Fixed"],
              ["Option order", r.exam.shuffleOptions ? "Shuffled per candidate" : "Fixed"],
              ["Answer review", r.exam.releaseAnswerReview ? "Shown with results" : "Hidden"],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="text-xs text-muted-foreground">{k}</dt>
                <dd className="font-medium">{v}</dd>
              </div>
            ))}
          </dl>
          {r.exam.instructions && (
            <div className="border-t p-5">
              <p className="mb-1 text-xs text-muted-foreground">Instructions</p>
              <p className="text-sm whitespace-pre-wrap">{r.exam.instructions}</p>
            </div>
          )}
        </Panel>

        <Panel>
          <PanelHeader title={`Questions (${r.items.length})`} />
          <ol className="divide-y">
            {r.items.map((it, i) => (
              <li key={it.questionId} className="flex gap-3 px-5 py-3 text-sm">
                <span className="w-6 shrink-0 text-muted-foreground tabular-nums">{i + 1}.</span>
                <div className="min-w-0 flex-1 space-y-1.5">
                  <p>{it.stem}</p>
                  <div className="flex flex-wrap gap-1.5">
                    <TypeBadge type={it.type} />
                    <DifficultyBadge difficulty={it.difficulty} />
                  </div>
                </div>
                <span className="shrink-0 font-medium tabular-nums">{fmtMarks(it.marks)}</span>
              </li>
            ))}
            {!r.items.length && <li className="px-5 py-8 text-center text-sm text-muted-foreground">No questions yet.</li>}
          </ol>
        </Panel>
      </div>

      <div className="space-y-6 lg:sticky lg:top-6 lg:self-start">
        <Panel>
          <PanelHeader
            title="Publication checklist"
            description={status === "draft" ? (blockers ? `${blockers} item${blockers === 1 ? "" : "s"} to fix` : "Ready to publish") : "Already published"}
          />
          <ul className="space-y-3 p-5">
            {r.checks.map((c) => {
              const Icon = c.ok ? (c.id === "written" ? Info : CheckCircle2) : c.blocking ? CircleAlert : AlertTriangle
              return (
                <li key={c.id} className="flex gap-3">
                  <Icon
                    className={cn(
                      "mt-0.5 size-4 shrink-0",
                      c.ok ? (c.id === "written" ? "text-info-text" : "text-success-text") : c.blocking ? "text-danger-text" : "text-warning-text"
                    )}
                    aria-hidden
                  />
                  <div className="text-sm">
                    <p className="font-medium">
                      {c.label}
                      <span className="sr-only">{c.ok ? ": passed" : c.blocking ? ": must fix" : ": recommended"}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">{c.detail}</p>
                  </div>
                </li>
              )
            })}
          </ul>
          {status === "draft" && (
            <div className="border-t p-5">
              <PublishButton examId={examId} ready={r.ready} />
            </div>
          )}
        </Panel>

        <Panel>
          <PanelHeader title="Sandbox previews" description="Your test runs. They never count in results or statistics." />
          <ul className="divide-y text-sm">
            {sandbox.map((s) => (
              <li key={s.id} className="flex items-center justify-between px-5 py-2.5">
                <span className="text-muted-foreground">{fmtDateTime(s.startedAt)}</span>
                {s.status === "in_progress" ? (
                  <Link href={`/attempt/${s.id}`} className="font-medium text-primary hover:underline">
                    Continue
                  </Link>
                ) : (
                  <span className="tabular-nums">
                    {fmtMarks(s.scoreTotal)} / {fmtMarks(s.maxMarks)}
                  </span>
                )}
              </li>
            ))}
            {!sandbox.length && <li className="px-5 py-4 text-muted-foreground">Use &quot;Preview as candidate&quot; above to try it.</li>}
          </ul>
        </Panel>
      </div>
    </div>
  )
}
