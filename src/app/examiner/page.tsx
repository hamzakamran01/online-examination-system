import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight, BookOpenCheck, CalendarDays, CheckCircle2, FilePlus2, FileUp, PenLine, Radio, Send, SquarePen, Timer, UserPlus } from "lucide-react"
import { requirePageRole } from "@/server/auth/guards"
import { getExaminerDashboard } from "@/server/services/dashboard"
import { Panel, PanelHeader } from "@/components/shell/page-header"
import { HeroBand, greeting, heroPrimary, heroSecondary } from "@/components/shell/hero"
import { MiniBars } from "@/components/shell/mini-bars"
import { fmtDateTime, fmtDuration } from "@/lib/format"
import { cn } from "@/lib/utils"

export const metadata: Metadata = { title: "Examiner desk" }

type Dash = Awaited<ReturnType<typeof getExaminerDashboard>>

const STAGE: Record<Dash["live"][number]["stage"], { label: string; cls: string }> = {
  draft: { label: "Draft", cls: "bg-muted text-muted-foreground" },
  scheduled: { label: "Scheduled", cls: "bg-info-soft text-info-text" },
  live: { label: "Live", cls: "bg-success-soft text-success-text" },
  grading: { label: "Grading", cls: "bg-time-soft text-time-text" },
  released: { label: "Results out", cls: "bg-brand-soft text-brand-text" },
}

const TODO_ICON = { grade: PenLine, publish: Send, enroll: UserPlus, draft: SquarePen } as const

function minutesLeft(end: Date, now: Date) {
  const m = Math.max(0, Math.round((end.getTime() - now.getTime()) / 60000))
  return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`
}

function LiveExam({ e, now }: { e: Dash["live"][number]; now: Date }) {
  const n = Math.max(1, e.enrolledCount)
  const done = (e.submittedCount / n) * 100
  const writing = (e.activeCount / n) * 100
  return (
    <li className="px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href={`/examiner/exams/${e.id}/results`} className="font-medium hover:underline">
            {e.title}
          </Link>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Window closes in <span className="font-medium text-foreground">{minutesLeft(e.endsAt, now)}</span> · {fmtDuration(e.durationMin)} per attempt
          </p>
        </div>
        <Link href={`/examiner/exams/${e.id}/results`} className="inline-flex items-center gap-1 text-sm font-medium text-brand-text hover:underline">
          Open
          <ArrowRight className="size-3.5" aria-hidden />
        </Link>
      </div>
      <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-muted" role="img" aria-label={`${e.submittedCount} submitted, ${e.activeCount} writing, of ${e.enrolledCount} enrolled`}>
        <span className="h-full bg-primary" style={{ width: `${done}%` }} />
        <span className="h-full bg-success" style={{ width: `${writing}%` }} />
      </div>
      <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-primary" aria-hidden />
          {e.submittedCount} submitted
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-success" aria-hidden />
          {e.activeCount} writing
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-muted-foreground/40" aria-hidden />
          {Math.max(0, e.enrolledCount - e.submittedCount - e.activeCount)} not started
        </span>
      </p>
    </li>
  )
}

export default async function ExaminerHome() {
  const actor = await requirePageRole("examiner")
  const d = await getExaminerDashboard(actor)
  const first = actor.name.replace(/^(Dr|Mr|Ms|Mrs|Prof)\.?\s+/i, "").split(" ")[0]
  const honorific = /^(Dr|Prof)\.?\s/i.test(actor.name) ? actor.name.split(" ")[0].replace(".", "") + ". " : ""

  const summary =
    d.counts.live > 0
      ? `${d.counts.live} exam${d.counts.live === 1 ? " is" : "s are"} live with ${d.counts.writing} candidate${d.counts.writing === 1 ? "" : "s"} writing.${d.counts.toGrade ? ` ${d.counts.toGrade} attempt${d.counts.toGrade === 1 ? "" : "s"} wait for your marks.` : ""}`
      : d.todo.length
        ? `No exam is live right now. You have ${d.todo.length} item${d.todo.length === 1 ? "" : "s"} on your list.`
        : "No exam is live right now and your list is clear."

  return (
    <>
      <HeroBand
        kicker={`${greeting(d.now)}, ${honorific}${first}`}
        title="Examiner desk"
        summary={summary}
        actions={
          <>
            <Link href="/examiner/exams/new" className={heroPrimary}>
              <FilePlus2 />
              New exam
            </Link>
            <Link href="/examiner/bank/new" className={heroSecondary}>
              <SquarePen />
              Write a question
            </Link>
            <Link href="/examiner/imports" className={heroSecondary}>
              <FileUp />
              Import
            </Link>
          </>
        }
        metrics={[
          { label: "Live now", value: d.counts.live, hint: `${d.counts.writing} writing` },
          { label: "To grade", value: d.counts.toGrade, hint: "Written attempts" },
          { label: "Scheduled", value: d.counts.scheduled, hint: "Within two weeks shown below" },
          { label: "Average score", value: d.counts.avgScore === null ? "No data" : `${d.counts.avgScore}%`, hint: "Across graded exams" },
        ]}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Panel>
            <PanelHeader
              title={
                <span className="inline-flex items-center gap-2">
                  <Radio className={cn("size-4", d.live.length ? "text-success-text" : "text-muted-foreground")} aria-hidden />
                  Live now
                </span>
              }
              description={d.live.length ? "Submission progress against enrolment, updated on every visit." : undefined}
            />
            {d.live.length ? (
              <ul className="divide-y">
                {d.live.map((e) => (
                  <LiveExam key={e.id} e={e} now={d.now} />
                ))}
              </ul>
            ) : (
              <p className="px-5 py-8 text-center text-sm text-muted-foreground">No exam window is open. Scheduled exams appear here the moment they open.</p>
            )}
          </Panel>

          <Panel>
            <PanelHeader
              title={
                <span className="inline-flex items-center gap-2">
                  <CalendarDays className="size-4 text-muted-foreground" aria-hidden />
                  Next two weeks
                </span>
              }
            />
            {d.upcoming.length ? (
              <ol className="divide-y">
                {d.upcoming.map((e) => (
                  <li key={e.id}>
                    <Link href={`/examiner/exams/${e.id}`} className="flex items-center gap-4 px-5 py-3 transition-colors hover:bg-muted/50">
                      <span className="flex w-14 shrink-0 flex-col items-center rounded-lg border py-1.5 leading-none">
                        <span className="text-[0.65rem] font-medium text-muted-foreground uppercase">{e.startsAt.toLocaleDateString("en-GB", { month: "short", timeZone: process.env.APP_TIMEZONE ?? "Asia/Karachi" })}</span>
                        <span className="font-display mt-1 text-xl font-semibold">{e.startsAt.toLocaleDateString("en-GB", { day: "numeric", timeZone: process.env.APP_TIMEZONE ?? "Asia/Karachi" })}</span>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{e.title}</span>
                        <span className="text-xs text-muted-foreground">
                          Opens {fmtDateTime(e.startsAt)} · {fmtDuration(e.durationMin)} · {e.enrolledCount} enrolled
                        </span>
                      </span>
                      {e.enrolledCount === 0 && <span className="shrink-0 rounded-full bg-time-soft px-2 py-0.5 text-xs font-medium text-time-text">No candidates</span>}
                    </Link>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="px-5 py-8 text-center text-sm text-muted-foreground">Nothing scheduled in the next two weeks.</p>
            )}
          </Panel>

          <Panel>
            <PanelHeader title="Recent results" description="Average score and grading state of exams whose window has closed." />
            {d.recent.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th className="px-5 py-2.5 font-medium">Exam</th>
                      <th className="px-3 py-2.5 font-medium">Submitted</th>
                      <th className="px-3 py-2.5 font-medium">Average</th>
                      <th className="px-5 py-2.5 text-right font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {d.recent.map((e) => (
                      <tr key={e.id} className="transition-colors hover:bg-muted/40">
                        <td className="px-5 py-3">
                          <Link href={`/examiner/exams/${e.id}/results`} className="font-medium hover:underline">
                            {e.title}
                          </Link>
                        </td>
                        <td className="px-3 py-3 text-muted-foreground tabular-nums">
                          {e.submittedCount} / {e.enrolledCount}
                        </td>
                        <td className="px-3 py-3">
                          {e.avgPercent === null ? (
                            <span className="text-muted-foreground">-</span>
                          ) : (
                            <span className="flex items-center gap-2">
                              <span className="h-1.5 w-16 overflow-hidden rounded-full bg-muted" aria-hidden>
                                <span className="block h-full rounded-full bg-primary" style={{ width: `${e.avgPercent}%` }} />
                              </span>
                              <span className="tabular-nums">{e.avgPercent}%</span>
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium", STAGE[e.stage].cls)}>
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

        <div className="flex flex-col gap-6">
          <Panel>
            <PanelHeader title="Your list" description={d.todo.length ? `${d.todo.length} item${d.todo.length === 1 ? "" : "s"}, most urgent first` : undefined} />
            {d.todo.length ? (
              <ul className="divide-y">
                {d.todo.slice(0, 7).map((t) => {
                  const Icon = TODO_ICON[t.kind]
                  return (
                    <li key={t.id}>
                      <Link href={t.href} className="flex items-start gap-3 px-5 py-3 transition-colors hover:bg-muted/50">
                        <span
                          className={cn(
                            "mt-0.5 grid size-7 shrink-0 place-items-center rounded-md",
                            t.kind === "grade" ? "bg-time-soft text-time-text" : t.kind === "publish" ? "bg-brand-soft text-brand-text" : "bg-muted text-muted-foreground"
                          )}
                          aria-hidden
                        >
                          <Icon className="size-3.5" />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium">{t.title}</span>
                          <span className="text-xs text-muted-foreground">{t.detail}</span>
                        </span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="flex items-center gap-2 px-5 py-6 text-sm text-muted-foreground">
                <CheckCircle2 className="size-4 text-success-text" aria-hidden />
                All caught up.
              </p>
            )}
          </Panel>

          <Panel>
            <PanelHeader title="Submissions" description={`${d.counts.submitted14} in the last 14 days`} />
            <div className="px-4 pt-3 pb-2">
              <MiniBars data={d.activity} label="Submissions per day" />
            </div>
          </Panel>

          <Panel>
            <PanelHeader
              title={
                <span className="inline-flex items-center gap-2">
                  <BookOpenCheck className="size-4 text-muted-foreground" aria-hidden />
                  Question bank
                </span>
              }
              actions={
                <Link href="/examiner/bank" className="text-sm font-medium text-brand-text hover:underline">
                  Open
                </Link>
              }
            />
            <div className="flex flex-col gap-4 p-5">
              <p className="font-display text-3xl font-semibold tabular-nums">
                {d.bank.total} <span className="font-sans text-sm font-normal text-muted-foreground">active questions</span>
              </p>
              <div>
                <p className="mb-1.5 text-xs text-muted-foreground">By difficulty</p>
                <div className="flex h-2 overflow-hidden rounded-full bg-muted" role="img" aria-label={d.bank.byDifficulty.map((x) => `${x.n} ${x.key}`).join(", ")}>
                  {d.bank.byDifficulty.map((x) => (
                    <span key={x.key} className={cn("h-full", x.key === "easy" ? "bg-success" : x.key === "medium" ? "bg-time" : "bg-danger")} style={{ width: `${d.bank.total ? (x.n / d.bank.total) * 100 : 0}%` }} />
                  ))}
                </div>
                <p className="mt-1.5 flex gap-3 text-xs text-muted-foreground">
                  {d.bank.byDifficulty.map((x) => (
                    <span key={x.key} className="capitalize">
                      {x.key} {x.n}
                    </span>
                  ))}
                </p>
              </div>
              <dl className="grid grid-cols-3 gap-px overflow-hidden rounded-lg border bg-border text-center">
                {d.bank.byType.map((x) => (
                  <div key={x.key} className="bg-surface px-2 py-2.5">
                    <dt className="text-[0.7rem] text-muted-foreground">{x.key === "single" ? "Single" : x.key === "multi" ? "Multi" : "Written"}</dt>
                    <dd className="font-medium tabular-nums">{x.n}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </Panel>
        </div>
      </div>

      <AllExams exams={[...d.live, ...d.upcoming, ...d.recent]} total={d.total} />
    </>
  )
}

function AllExams({ exams, total }: { exams: Dash["live"]; total: number }) {
  return (
    <p className="mt-8 flex items-center gap-2 text-sm text-muted-foreground">
      <Timer className="size-4" aria-hidden />
      {total} exam{total === 1 ? "" : "s"} in total.{" "}
      <Link href="/examiner/exams" className="font-medium text-brand-text hover:underline">
        Browse every exam by stage
      </Link>
      {exams.length === 0 && null}
    </p>
  )
}
