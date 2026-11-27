import Link from "next/link"
import { ArrowRight, PlayCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { Countdown } from "@/features/attempts/countdown"
import { ClockDial } from "./decor"

/*
 * Context widgets for the sidebar: the one live thing each role should never
 * lose sight of, rendered on the server from real data and refreshed on navigation.
 */

function Card({ title, live, children, className }: { title: string; live?: boolean; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-xl border border-sidebar-border bg-sidebar-accent p-3", className)} aria-label={title}>
      <p className="eyebrow mb-2 flex items-center gap-1.5 text-sidebar-foreground/70">
        {live && <span className="size-1.5 animate-live rounded-full bg-success text-success" aria-hidden />}
        {title}
      </p>
      {children}
    </section>
  )
}

export type NextExamLite = { id: string; title: string; startsAt: Date }

/** Examiner: countdown to the next scheduled sitting. */
export function ExaminerWidget({ next }: { next?: NextExamLite }) {
  if (next)
    return (
      <Card title="Next sitting">
        <Link href={`/examiner/exams/${next.id}`} className="block truncate text-[0.8rem] font-medium text-sidebar-foreground hover:underline">
          {next.title}
        </Link>
        <p className="mt-0.5 text-[0.7rem] text-sidebar-foreground/75">
          Opens in <Countdown to={next.startsAt.toISOString()} className="font-mono font-medium text-foreground tabular-nums" />
        </p>
      </Card>
    )
  return null
}

/** Candidate: the exam to resume, the one open now, or the countdown to the next. */
export function CandidateWidget({ focus }: { focus?: { id: string; title: string; kind: "resume" | "open" | "upcoming"; attemptId?: string; opensAt?: Date } }) {
  if (!focus) return null
  if (focus.kind === "upcoming" && focus.opensAt)
    return (
      <Card title="Next exam">
        <div className="flex items-center gap-3">
          <ClockDial className="size-10 shrink-0 text-border-strong" />
          <div className="min-w-0">
            <Link href={`/candidate/exams/${focus.id}`} className="block truncate text-[0.8rem] font-medium text-sidebar-foreground hover:underline">
              {focus.title}
            </Link>
            <Countdown to={focus.opensAt.toISOString()} className="font-mono text-sm font-semibold tabular-nums" />
          </div>
        </div>
      </Card>
    )
  const href = focus.kind === "resume" && focus.attemptId ? `/attempt/${focus.attemptId}` : `/candidate/exams/${focus.id}`
  return (
    <Card title={focus.kind === "resume" ? "In progress" : "Open now"} live className={focus.kind === "resume" ? "border-time/40" : undefined}>
      <p className="truncate text-[0.8rem] font-medium text-sidebar-foreground">{focus.title}</p>
      <Link
        href={href}
        className="mt-2 flex h-8 items-center justify-center gap-1.5 rounded-lg bg-primary text-xs font-semibold text-primary-foreground shadow-edge transition-colors hover:bg-primary-hover"
      >
        <PlayCircle className="size-3.5" aria-hidden />
        {focus.kind === "resume" ? "Resume exam" : "Go to lobby"}
      </Link>
    </Card>
  )
}

/** Administrator: the platform pulse in three numbers, each linked to where it is explained. */
export function AdminWidget({ writing, today, attention }: { writing: number; today: number; attention: number }) {
  const rows = [
    { label: "Writing now", n: writing, tone: writing ? "text-success-text" : "" },
    { label: "Submitted today", n: today, tone: "" },
    { label: "Needs attention", n: attention, tone: attention ? "text-time-text" : "" },
  ]
  return (
    <Card title="Platform pulse" live={writing > 0}>
      <dl className="space-y-1">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between text-[0.8rem]">
            <dt className="text-sidebar-foreground/75">{r.label}</dt>
            <dd className={cn("font-semibold tabular-nums", r.tone)}>{r.n}</dd>
          </div>
        ))}
      </dl>
      <Link href="/admin/overview" className="mt-2 inline-flex items-center gap-1 text-[0.7rem] font-medium text-sidebar-primary hover:underline">
        Open overview
        <ArrowRight className="size-3" aria-hidden />
      </Link>
    </Card>
  )
}
