import type { Metadata } from "next"
import Link from "next/link"
import {
  Activity,
  ArrowRight,
  BookOpenCheck,
  CalendarDays,
  CheckCircle2,
  FilePlus2,
  FileUp,
  Inbox,
  Layers,
  ListChecks,
  PenLine,
  Radio,
  Send,
  SquarePen,
  Target,
  UserPlus,
} from "lucide-react"
import { requirePageRole } from "@/server/auth/guards"
import { getExaminerDashboard } from "@/server/services/dashboard"
import { Panel } from "@/components/shell/page-header"
import { greeting } from "@/components/shell/hero"
import { CardTitle, DashHeader, KpiGrid, todayLabel } from "@/components/shell/dashboard"
import { BubbleField, ClockDial, ContourLines } from "@/components/shell/decor"
import { buttonVariants } from "@/components/ui/button"
import { fmtDateTime, fmtDuration } from "@/lib/format"
import { cn } from "@/lib/utils"

export const metadata: Metadata = { title: "Examiner desk" }

type Dash = Awaited<ReturnType<typeof getExaminerDashboard>>
type Stage = Dash["stages"][number]["key"]

const STAGE: Record<Stage, { label: string; cls: string; bar: string }> = {
  draft: { label: "Draft", cls: "bg-muted text-muted-foreground", bar: "bg-border-strong" },
  scheduled: { label: "Scheduled", cls: "bg-info-soft text-info-text", bar: "bg-info" },
  live: { label: "Live", cls: "bg-success-soft text-success-text", bar: "bg-success" },
  grading: { label: "Grading", cls: "bg-time-soft text-time-text", bar: "bg-time" },
  released: { label: "Results out", cls: "bg-brand-soft text-brand-text", bar: "bg-primary" },
}

const TODO = {
  grade: { icon: PenLine, cls: "bg-time-soft text-time-text", tag: "Grade" },
  publish: { icon: Send, cls: "bg-brand-soft text-brand-text", tag: "Publish" },
  enroll: { icon: UserPlus, cls: "bg-danger-soft text-danger-text", tag: "Enrol" },
  draft: { icon: SquarePen, cls: "bg-muted text-muted-foreground", tag: "Draft" },
} as const

const TZ = process.env.APP_TIMEZONE ?? "Asia/Karachi"
const TIME = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: TZ })

function timeLeft(end: Date, now: Date) {
  const m = Math.max(0, Math.round((end.getTime() - now.getTime()) / 60000))
  return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`
}

function LiveExam({ e, now }: { e: Dash["live"][number]; now: Date }) {
  const n = Math.max(1, e.enrolledCount)
  const notStarted = Math.max(0, e.enrolledCount - e.submittedCount - e.activeCount)
  const span = e.endsAt.getTime() - e.startsAt.getTime()
  const elapsed = span > 0 ? (now.getTime() - e.startsAt.getTime()) / span : 0
  return (
    <li className="grid gap-4 px-5 py-4 sm:grid-cols-[72px_minmax(0,1fr)_auto] sm:items-center">
      <div className="relative hidden size-[72px] sm:block">
        <ClockDial progress={elapsed} className="size-full text-border-strong" arcClassName="text-success" />
        <span className="absolute inset-0 grid place-items-center text-xs font-semibold tabular-nums">{Math.round(Math.min(1, elapsed) * 100)}%</span>
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/examiner/exams/${e.id}/monitor`} className="truncate font-medium hover:underline">
            {e.title}
          </Link>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-success-soft px-2 py-0.5 text-xs font-medium text-success-text ring-1 ring-current/15 ring-inset">
            <span className="size-1.5 animate-live rounded-full bg-current" aria-hidden />
            Live
          </span>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {TIME.format(e.startsAt)} to {TIME.format(e.endsAt)} · closes in <span className="font-medium text-foreground">{timeLeft(e.endsAt, now)}</span> · {fmtDuration(e.durationMin)} per attempt
        </p>
        <div
          className="mt-2.5 flex h-2 overflow-hidden rounded-full bg-muted"
          role="img"
          aria-label={`${e.submittedCount} submitted, ${e.activeCount} writing, ${notStarted} not started, of ${e.enrolledCount} enrolled`}
        >
          <span className="h-full bg-primary" style={{ width: `${(e.submittedCount / n) * 100}%` }} />
          <span className="h-full bg-success" style={{ width: `${(e.activeCount / n) * 100}%` }} />
        </div>
        <p className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground tabular-nums">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-sm bg-primary" aria-hidden />
            {e.submittedCount} submitted
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-sm bg-success" aria-hidden />
            {e.activeCount} writing
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-sm bg-muted-foreground/30" aria-hidden />
            {notStarted} not started
          </span>
        </p>
      </div>
      <div className="flex gap-2 sm:flex-col">
        <Link href={`/examiner/exams/${e.id}/monitor`} className={buttonVariants({ size: "sm" })}>
          <Activity />
          Monitor
        </Link>
        <Link href={`/examiner/exams/${e.id}/results`} className={buttonVariants({ size: "sm", variant: "outline" })}>
          Results
        </Link>
      </div>
    </li>
  )
}

export default async function ExaminerHome() {
  const actor = await requirePageRole("examiner")
  const d = await getExaminerDashboard(actor)
  const first = actor.name.replace(/^(Dr|Mr|Ms|Mrs|Prof)\.?\s+/i, "").split(" ")[0]
  const honorific = /^(Dr|Prof)\.?\s/i.test(actor.name) ? actor.name.split(" ")[0].replace(".", "") + ". " : ""
  const plural = (n: number, one: string, many = one + "s") => `${n} ${n === 1 ? one : many}`

  const status =
    d.counts.live > 0
      ? `${plural(d.counts.live, "exam is", "exams are")} live with ${plural(d.counts.writing, "candidate")} writing.${d.counts.toGrade ? ` ${plural(d.counts.toGrade, "attempt waits", "attempts wait")} for your marks.` : ""}`
      : d.todo.length
        ? `No exam is live. ${plural(d.todo.length, "item")} on your action queue.`
        : "No exam is live and your action queue is clear."
  const gradeHref = d.todo.find((t) => t.kind === "grade")?.href ?? "/examiner/exams?stage=grading"
  const stageTotal = d.stages.reduce((n, s) => n + s.n, 0)

  return (
    <>
      <DashHeader
        eyebrow={`${todayLabel(d.now)} · Examiner desk`}
        title={`${greeting(d.now)}, ${honorific}${first}`}
        status={status}
        pulse={d.counts.live ? "live" : d.todo.length ? "attention" : "ok"}
        actions={
          <>
            <Link href="/examiner/imports" className={buttonVariants({ variant: "outline", size: "lg" })}>
              <FileUp />
              Import
            </Link>
            <Link href="/examiner/bank/new" className={buttonVariants({ variant: "outline", size: "lg" })}>
              <SquarePen />
              Write a question
            </Link>
            <Link href="/examiner/exams/new" className={buttonVariants({ size: "lg" })}>
              <FilePlus2 />
              New exam
            </Link>
          </>
        }
      />

      <KpiGrid
        items={[
          { label: "Live now", value: d.counts.live, hint: `${plural(d.counts.writing, "candidate")} writing`, icon: Radio, tone: "success", live: d.counts.live > 0, href: "/examiner/exams?stage=live" },
          { label: "To grade", value: d.counts.toGrade, hint: d.counts.toGrade ? "Written answers waiting" : "Nothing waiting", icon: PenLine, tone: "time", href: gradeHref },
          { label: "Submissions", value: d.counts.submitted14, hint: "Last 14 days, sandbox excluded", icon: Inbox, tone: "brand", spark: d.activity.map((a) => a.count) },
          {
            label: "Average score",
            value: d.counts.avgScore === null ? "None" : `${d.counts.avgScore}%`,
            hint: "Across graded exams",
            icon: Target,
            tone: "info",
            meter: d.counts.avgScore ?? 0,
            href: "/examiner/exams?stage=released",
          },
        ]}
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-5 lg:col-span-2">
          <Panel className="overflow-hidden">
            <CardTitle icon={Radio} title="Live operations" meta={d.live.length} href="/examiner/exams?stage=live" />
            {d.live.length ? (
              <ul className="divide-y">
                {d.live.map((e) => (
                  <LiveExam key={e.id} e={e} now={d.now} />
                ))}
              </ul>
            ) : (
              <div className="relative isolate overflow-hidden px-5 py-10 text-center">
                <ContourLines className="absolute inset-0 -z-10 size-full text-brand-text/[0.08]" />
                <p className="font-medium">No exam window is open</p>
                <p className="mt-1 text-sm text-muted-foreground">Scheduled exams appear here with live progress the moment they open.</p>
              </div>
            )}
          </Panel>

          <Panel className="overflow-hidden">
            <CardTitle icon={CalendarDays} title="Schedule, next two weeks" meta={d.upcoming.length} href="/examiner/exams?stage=scheduled" />
            {d.upcoming.length ? (
              <ol className="divide-y">
                {d.upcoming.map((e) => (
                  <li key={e.id}>
                    <Link href={`/examiner/exams/${e.id}`} className="flex items-center gap-4 px-5 py-3 transition-colors hover:bg-brand-softer">
                      <span className="flex w-14 shrink-0 flex-col items-center overflow-hidden rounded-lg border bg-surface leading-none shadow-xs">
                        <span className="w-full bg-primary py-1 text-center text-[0.6rem] font-semibold tracking-wider text-primary-foreground uppercase">
                          {e.startsAt.toLocaleDateString("en-GB", { month: "short", timeZone: TZ })}
                        </span>
                        <span className="font-display py-1.5 text-xl font-semibold">{e.startsAt.toLocaleDateString("en-GB", { day: "numeric", timeZone: TZ })}</span>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{e.title}</span>
                        <span className="text-xs text-muted-foreground">
                          Opens {fmtDateTime(e.startsAt)} · {fmtDuration(e.durationMin)} · {e.questionCount} questions
                        </span>
                      </span>
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium tabular-nums ring-1 ring-current/15 ring-inset",
                          e.enrolledCount ? "bg-info-soft text-info-text" : "bg-danger-soft text-danger-text"
                        )}
                      >
                        {e.enrolledCount ? `${e.enrolledCount} enrolled` : "No candidates"}
                      </span>
                    </Link>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="px-5 py-8 text-center text-sm text-muted-foreground">Nothing scheduled in the next two weeks.</p>
            )}
          </Panel>

          <Panel className="overflow-hidden">
            <CardTitle icon={ListChecks} title="Recent results" meta={d.recent.length} href="/examiner/exams?stage=grading" />
            {d.recent.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="px-5 py-2.5">Exam</th>
                      <th className="px-3 py-2.5">Submitted</th>
                      <th className="px-3 py-2.5">Average</th>
                      <th className="px-5 py-2.5 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {d.recent.map((e) => (
                      <tr key={e.id}>
                        <td className="px-5 py-3">
                          <Link href={`/examiner/exams/${e.id}/results`} className="font-medium hover:underline">
                            {e.title}
                          </Link>
                        </td>
                        <td className="px-3 py-3 text-muted-foreground">
                          {e.submittedCount} / {e.enrolledCount}
                        </td>
                        <td className="px-3 py-3">
                          {e.avgPercent === null ? (
                            <span className="text-muted-foreground">Pending</span>
                          ) : (
                            <span className="flex items-center gap-2">
                              <span className="h-1.5 w-16 overflow-hidden rounded-full bg-muted" aria-hidden>
                                <span className="block h-full rounded-full bg-primary" style={{ width: `${e.avgPercent}%` }} />
                              </span>
                              {e.avgPercent}%
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-current/15 ring-inset", STAGE[e.stage].cls)}>
                            <span className="size-1.5 rounded-full bg-current" aria-hidden />
                            {e.stage === "grading" && e.toGradeCount ? `${e.toGradeCount} to grade` : STAGE[e.stage].label}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="px-5 py-8 text-center text-sm text-muted-foreground">Results appear here after an exam window closes.</p>
            )}
          </Panel>
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          <Panel className="overflow-hidden">
            <CardTitle icon={ListChecks} title="Action queue" meta={d.todo.length} />
            {d.todo.length ? (
              <ol className="divide-y">
                {d.todo.slice(0, 7).map((t, i) => {
                  const c = TODO[t.kind]
                  return (
                    <li key={t.id}>
                      <Link href={t.href} className="group flex items-center gap-3 px-5 py-3 transition-colors hover:bg-brand-softer">
                        <span className="w-4 shrink-0 text-xs font-medium text-subtle-foreground tabular-nums">{i + 1}</span>
                        <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg", c.cls)} aria-hidden>
                          <c.icon className="size-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{t.title}</span>
                          <span className="text-xs text-muted-foreground">{t.detail}</span>
                        </span>
                        <ArrowRight className="size-4 shrink-0 text-subtle-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" aria-hidden />
                      </Link>
                    </li>
                  )
                })}
              </ol>
            ) : (
              <div className="relative isolate flex flex-col items-center overflow-hidden px-5 py-8 text-center">
                <BubbleField rows={4} groups={3} seed={11} className="absolute -top-2 left-1/2 -z-10 -translate-x-1/2 text-brand-text/15" />
                <CheckCircle2 className="mt-10 size-6 text-success-text" aria-hidden />
                <p className="mt-2 text-sm font-medium">All caught up</p>
                <p className="text-xs text-muted-foreground">Grading, publishing and enrolment are clear.</p>
              </div>
            )}
          </Panel>

          <Panel className="overflow-hidden">
            <CardTitle icon={Layers} title="Exam portfolio" meta={stageTotal} href="/examiner/exams" />
            <div className="p-5">
              <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full" role="img" aria-label={d.stages.map((s) => `${s.n} ${STAGE[s.key].label}`).join(", ")}>
                {stageTotal ? (
                  d.stages.filter((s) => s.n).map((s) => <span key={s.key} className={cn("h-full first:rounded-l-full last:rounded-r-full", STAGE[s.key].bar)} style={{ flexGrow: s.n }} />)
                ) : (
                  <span className="h-full flex-1 bg-muted" />
                )}
              </div>
              <ul className="mt-4 space-y-1">
                {d.stages.map((s) => (
                  <li key={s.key}>
                    <Link href={`/examiner/exams?stage=${s.key}`} className="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted">
                      <span className={cn("size-2.5 rounded-sm", STAGE[s.key].bar)} aria-hidden />
                      <span className="flex-1">{STAGE[s.key].label}</span>
                      <span className="font-medium tabular-nums">{s.n}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </Panel>

          <Panel className="overflow-hidden">
            <CardTitle icon={BookOpenCheck} title="Question bank" meta={d.bank.total} href="/examiner/bank" linkLabel="Open" />
            <div className="flex flex-col gap-4 p-5">
              <div>
                <p className="eyebrow mb-2 text-muted-foreground">By difficulty</p>
                <div className="flex h-2 gap-0.5 overflow-hidden rounded-full bg-muted" role="img" aria-label={d.bank.byDifficulty.map((x) => `${x.n} ${x.key}`).join(", ")}>
                  {d.bank.byDifficulty.map((x) => (
                    <span key={x.key} className={cn("h-full", x.key === "easy" ? "bg-success" : x.key === "medium" ? "bg-time" : "bg-danger")} style={{ width: `${d.bank.total ? (x.n / d.bank.total) * 100 : 0}%` }} />
                  ))}
                </div>
                <p className="mt-2 flex gap-4 text-xs text-muted-foreground">
                  {d.bank.byDifficulty.map((x) => (
                    <span key={x.key} className="inline-flex items-center gap-1.5 capitalize">
                      <span className={cn("size-2 rounded-sm", x.key === "easy" ? "bg-success" : x.key === "medium" ? "bg-time" : "bg-danger")} aria-hidden />
                      {x.key} <span className="font-medium text-foreground tabular-nums">{x.n}</span>
                    </span>
                  ))}
                </p>
              </div>
              <dl className="grid grid-cols-3 gap-px overflow-hidden rounded-lg border bg-border text-center">
                {d.bank.byType.map((x) => (
                  <div key={x.key} className="bg-surface px-2 py-3">
                    <dt className="eyebrow text-muted-foreground">{x.key === "single" ? "Single" : x.key === "multi" ? "Multi" : "Written"}</dt>
                    <dd className="font-display mt-1 text-xl font-semibold tabular-nums">{x.n}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </Panel>
        </div>
      </div>
    </>
  )
}
