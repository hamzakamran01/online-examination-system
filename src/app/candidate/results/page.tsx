import type { Metadata } from "next"
import Link from "next/link"
import { ClipboardList, ShieldCheck, TrendingDown, TrendingUp } from "lucide-react"
import { requirePageRole } from "@/server/auth/guards"
import { getCandidateTranscript } from "@/server/services/candidate-results"
import { HeroBand } from "@/components/shell/hero"
import { Panel, PanelHeader } from "@/components/shell/page-header"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { ResultsTimeline, TrendChart } from "@/features/results/results-journey"

export const metadata: Metadata = { title: "Results" }

export default async function ResultsPage() {
  const actor = await requirePageRole("candidate")
  const t = await getCandidateTranscript(actor)
  const s = t.stats

  const delta =
    s.delta === null ? null : (
      <span className={s.delta >= 0 ? "text-[oklch(0.86_0.12_150)]" : "text-[oklch(0.86_0.1_60)]"}>
        {s.delta >= 0 ? <TrendingUp className="mr-1 inline size-3.5" aria-hidden /> : <TrendingDown className="mr-1 inline size-3.5" aria-hidden />}
        {s.delta >= 0 ? "+" : ""}
        {s.delta} points vs previous
      </span>
    )

  return (
    <>
      <HeroBand
        kicker="Your transcript"
        title="Results"
        summary={
          s.published
            ? `You have ${s.published} published result${s.published === 1 ? "" : "s"}${s.awaiting ? ` and ${s.awaiting} awaiting publication` : ""}. Open any attempt to see where you earned and lost marks.`
            : s.sat
              ? "Your examiners have not published results yet. Your submitted attempts are listed below."
              : "Your results will build up here after each exam."
        }
        metrics={[
          { label: "Average", value: s.average === null ? "None yet" : `${s.average}%`, hint: delta ?? "Across published exams" },
          { label: "Best", value: s.best === null ? "None yet" : `${s.best}%` },
          { label: "Passed", value: s.withPassMark ? `${s.passed} of ${s.withPassMark}` : "-", hint: s.withPassMark ? "Exams with a pass mark" : "No pass marks set yet" },
          { label: "Awaiting", value: s.awaiting, hint: "Submitted, not yet published" },
        ]}
      />

      {!t.entries.length ? (
        <Empty className="rounded-xl border bg-surface py-16">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ClipboardList />
            </EmptyMedia>
            <EmptyTitle>No attempts yet</EmptyTitle>
            <EmptyDescription>Once you submit an exam it appears here, and its marks follow when your examiner publishes them.</EmptyDescription>
          </EmptyHeader>
          <Link href="/candidate" className="text-sm font-medium text-brand-text hover:underline">
            Go to my exams
          </Link>
        </Empty>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <ResultsTimeline entries={t.entries} />
          </div>
          <aside className="flex flex-col gap-6">
            <Panel>
              <PanelHeader title="Score trend" description={t.trend.length > 1 ? "Each published exam, oldest to newest" : undefined} />
              <div className="px-3 pt-3 pb-2">
                {t.trend.length > 1 ? (
                  <TrendChart points={t.trend} />
                ) : (
                  <p className="px-2 py-8 text-center text-sm text-muted-foreground">Your trend appears after two published results.</p>
                )}
              </div>
            </Panel>
            <Panel>
              <PanelHeader title="Habits" description="From your published papers" />
              <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-b-xl bg-border">
                <div className="bg-surface px-5 py-4">
                  <dt className="text-xs text-muted-foreground">Objective accuracy</dt>
                  <dd className="font-display mt-1 text-2xl font-semibold tabular-nums">{s.objectiveAccuracy === null ? "None" : `${s.objectiveAccuracy}%`}</dd>
                  <dd className="text-xs text-muted-foreground">Full marks on choice questions</dd>
                </div>
                <div className="bg-surface px-5 py-4">
                  <dt className="text-xs text-muted-foreground">Questions attempted</dt>
                  <dd className="font-display mt-1 text-2xl font-semibold tabular-nums">{s.answeredRate === null ? "None" : `${s.answeredRate}%`}</dd>
                  <dd className="text-xs text-muted-foreground">Answered, not skipped</dd>
                </div>
              </dl>
            </Panel>
            <Panel className="flex gap-3 p-5">
              <ShieldCheck className="mt-0.5 size-5 shrink-0 text-brand-text" aria-hidden />
              <p className="text-sm text-muted-foreground">
                Each result PDF carries a verification code. Share it with anyone who needs proof; they can check it on the{" "}
                <Link href="/verify" className="font-medium text-brand-text hover:underline">
                  public verify page
                </Link>
                , which shows only your shortened name, the exam and the score.
              </p>
            </Panel>
          </aside>
        </div>
      )}
    </>
  )
}
