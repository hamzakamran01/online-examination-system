import type { Metadata } from "next"
import Link from "next/link"
import { AlertCircle, ArrowUpRight, CalendarClock, FilePlus2, PenLine, Radio, Users } from "lucide-react"
import { requirePageRole } from "@/server/auth/guards"
import { listManagedExams } from "@/server/services/exams"
import { MetricStrip, PageHeader, Stat } from "@/components/shell/page-header"
import { buttonVariants } from "@/components/ui/button"
import { fmtDateTime, fmtDuration, fmtMarks } from "@/lib/format"
import { cn } from "@/lib/utils"

export const metadata: Metadata = { title: "Exams" }

type Exam = Awaited<ReturnType<typeof listManagedExams>>[number]
type Stage = Exam["stage"]

const STAGES: { key: Stage; title: string; empty: string }[] = [
  { key: "draft", title: "Draft", empty: "No drafts." },
  { key: "scheduled", title: "Scheduled", empty: "Nothing waiting to open." },
  { key: "live", title: "Live", empty: "No exam is open right now." },
  { key: "grading", title: "Grading", empty: "Nothing to grade." },
  { key: "released", title: "Results out", empty: "No results published yet." },
]

const DOT: Record<Stage, string> = {
  draft: "bg-subtle-foreground",
  scheduled: "bg-info",
  live: "bg-success",
  grading: "bg-time",
  released: "bg-primary",
}

function nextStep(e: Exam): { label: string; href: string } {
  const base = `/examiner/exams/${e.id}`
  if (e.stage === "draft") return e.questionCount ? { label: "Review and publish", href: `${base}/review` } : { label: "Add questions", href: `${base}/questions` }
  if (e.stage === "scheduled") return e.enrolledCount ? { label: "Check candidates", href: `${base}/candidates` } : { label: "Enroll candidates", href: `${base}/candidates` }
  if (e.stage === "live") return { label: "Open results", href: `${base}/results` }
  if (e.stage === "grading") return e.toGradeCount ? { label: `Grade ${e.toGradeCount}`, href: `${base}/results` } : { label: "Publish results", href: `${base}/results` }
  return { label: "See analytics", href: `${base}/analytics` }
}

function ExamCard({ e }: { e: Exam }) {
  const step = nextStep(e)
  const pct = Math.round(e.windowProgress * 100)
  return (
    <li className="relative rounded-lg border bg-surface p-3.5 transition-colors hover:border-border-strong">
      <Link href={`/examiner/exams/${e.id}`} className="block text-sm leading-snug font-medium after:absolute after:inset-0 after:content-['']">
        {e.title}
      </Link>
      <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
        <CalendarClock className="size-3.5 shrink-0" aria-hidden />
        <span className="truncate">{fmtDateTime(e.startsAt)}</span>
      </p>
      {e.stage === "live" && (
        <div className="mt-3">
          <div className="h-1 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label="Exam window elapsed" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full rounded-full bg-success" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">
            <span className="font-medium text-success-text">{e.activeCount} writing</span> · {e.submittedCount} of {e.enrolledCount} submitted
          </p>
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span>{fmtDuration(e.durationMin)}</span>
        <span>{e.questionCount} questions</span>
        <span>{fmtMarks(e.totalMarks)} marks</span>
        <span className="inline-flex items-center gap-1">
          <Users className="size-3" aria-hidden />
          <span className="sr-only">Enrolled:</span>
          {e.enrolledCount}
        </span>
      </div>
      <Link href={step.href} className="relative z-10 mt-3 inline-flex items-center gap-1 text-xs font-medium text-brand-text hover:underline">
        {step.label}
        <ArrowUpRight className="size-3" aria-hidden />
      </Link>
    </li>
  )
}

export default async function ExaminerHome() {
  const actor = await requirePageRole("examiner")
  const exams = await listManagedExams(actor)
  const by = (s: Stage) => exams.filter((e) => e.stage === s)
  const writing = exams.reduce((n, e) => n + e.activeCount, 0)
  const toGrade = exams.reduce((n, e) => n + e.toGradeCount, 0)

  const attention = [
    ...exams
      .filter((e) => e.stage === "grading" && e.toGradeCount > 0)
      .map((e) => ({ e, text: `${e.toGradeCount} attempt${e.toGradeCount === 1 ? "" : "s"} waiting for marks`, href: `/examiner/exams/${e.id}/results`, icon: PenLine })),
    ...exams
      .filter((e) => e.stage === "grading" && e.toGradeCount === 0 && e.submittedCount > 0)
      .map((e) => ({ e, text: "Fully graded, ready to publish results", href: `/examiner/exams/${e.id}/results`, icon: PenLine })),
    ...exams
      .filter((e) => e.stage === "scheduled" && e.enrolledCount === 0)
      .map((e) => ({ e, text: "Scheduled with nobody enrolled", href: `/examiner/exams/${e.id}/candidates`, icon: Users })),
    ...exams
      .filter((e) => e.stage === "draft" && e.questionCount === 0)
      .map((e) => ({ e, text: "Draft has no questions yet", href: `/examiner/exams/${e.id}/questions`, icon: AlertCircle })),
  ]

  return (
    <>
      <PageHeader
        title="Examinations"
        description="Every exam you own, arranged by lifecycle. Each card points to its next step."
        actions={
          <Link href="/examiner/exams/new" className={buttonVariants()}>
            <FilePlus2 />
            New exam
          </Link>
        }
      />

      <MetricStrip className="mb-6">
        <Stat label="Live now" value={by("live").length} tone={by("live").length ? "success" : undefined} hint={by("live").length ? "Window open" : "No open windows"} />
        <Stat label="Candidates writing" value={writing} hint="Active attempts across exams" />
        <Stat label="Attempts to grade" value={toGrade} tone={toGrade ? "time" : undefined} hint="Written answers awaiting marks" />
        <Stat label="Scheduled" value={by("scheduled").length} hint="Published, not yet open" />
      </MetricStrip>

      {attention.length > 0 && (
        <section aria-labelledby="attn" className="mb-6 rounded-xl border bg-surface">
          <h2 id="attn" className="flex items-center gap-2 border-b px-5 py-3 text-sm font-semibold">
            <Radio className="size-4 text-time-text" aria-hidden />
            Needs your attention
            <span className="rounded-full bg-time-soft px-2 text-xs font-medium text-time-text tabular-nums">{attention.length}</span>
          </h2>
          <ul className="divide-y">
            {attention.slice(0, 5).map(({ e, text, href, icon: Icon }) => (
              <li key={e.id + text}>
                <Link href={href} className="flex items-center gap-3 px-5 py-3 text-sm transition-colors hover:bg-muted/60">
                  <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="font-medium">{e.title}</span>
                    <span className="text-muted-foreground"> · {text}</span>
                  </span>
                  <ArrowUpRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-label="Exam lifecycle board" className="-mx-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
        <div className="grid min-w-[1000px] grid-cols-5 gap-3">
          {STAGES.map((s) => {
            const list = by(s.key)
            return (
              <div key={s.key} className="flex flex-col rounded-xl border bg-surface-sunken p-2">
                <h2 className="flex items-center gap-2 px-1.5 pt-1 pb-2.5 text-sm font-semibold">
                  <span className={cn("size-2 rounded-full", DOT[s.key], s.key === "live" && list.length > 0 && "animate-live text-success")} aria-hidden />
                  {s.title}
                  <span className="ml-auto text-xs font-normal text-muted-foreground tabular-nums">{list.length}</span>
                </h2>
                {list.length ? (
                  <ul className="flex flex-col gap-2">
                    {list.map((e) => (
                      <ExamCard key={e.id} e={e} />
                    ))}
                  </ul>
                ) : (
                  <p className="rounded-lg border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">{s.empty}</p>
                )}
              </div>
            )
          })}
        </div>
      </section>
    </>
  )
}
