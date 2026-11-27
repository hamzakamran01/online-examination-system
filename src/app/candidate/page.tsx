import type { Metadata } from "next"
import Link from "next/link"
import {
  ArrowRight,
  Award,
  CalendarClock,
  ClipboardList,
  Clock,
  CloudOff,
  FileCheck2,
  Flag,
  Lock,
  PlayCircle,
  ShieldCheck,
  SlidersHorizontal,
  Target,
  Timer,
  TrendingUp,
} from "lucide-react"
import { requirePageRole } from "@/server/auth/guards"
import type { listCandidateExams } from "@/server/services/attempts"
import { getCandidateDashboard } from "@/server/services/dashboard"
import { greeting } from "@/components/shell/hero"
import { Panel } from "@/components/shell/page-header"
import { CardTitle, DashHeader, KpiGrid, Sparkline, todayLabel } from "@/components/shell/dashboard"
import { BubbleField, ClockDial } from "@/components/shell/decor"
import { buttonVariants } from "@/components/ui/button"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Countdown } from "@/features/attempts/countdown"
import { fmtDateTime, fmtDuration, fmtMarks } from "@/lib/format"
import { cn } from "@/lib/utils"

export const metadata: Metadata = { title: "My exams" }

type Item = Awaited<ReturnType<typeof listCandidateExams>>[number]

function Status({ e }: { e: Item }) {
  const a = e.access
  const map = {
    open: ["Open now", "bg-success-soft text-success-text"],
    resume: ["In progress", "bg-time-soft text-time-text"],
    upcoming: ["Upcoming", "bg-info-soft text-info-text"],
    submitted: [e.resultsPublishedAt ? "Result published" : "Submitted", e.resultsPublishedAt ? "bg-brand-soft text-brand-text" : "bg-muted text-muted-foreground"],
    closed: ["Missed", "bg-danger-soft text-danger-text"],
  } as const
  const [label, cls] = map[a.kind]
  return (
    <span className={cn("inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium ring-1 ring-current/15 ring-inset", cls)}>
      <span className={cn("size-1.5 rounded-full bg-current", (a.kind === "open" || a.kind === "resume") && "animate-live")} aria-hidden />
      {label}
    </span>
  )
}

/** The single most relevant exam: something to resume, then open, then the next upcoming. */
function pickFocus(items: Item[]) {
  return items.find((e) => e.access.kind === "resume") ?? items.find((e) => e.access.kind === "open") ?? items.find((e) => e.access.kind === "upcoming")
}

function Focus({ e }: { e: Item }) {
  const a = e.access
  const href = a.kind === "resume" ? `/attempt/${a.attemptId}` : `/candidate/exams/${e.id}`
  const facts: [typeof Clock, string, string][] = [
    [CalendarClock, "Opens", fmtDateTime(e.startsAt)],
    [Clock, "Duration", fmtDuration(e.durationMin)],
    [ClipboardList, "Paper", `${e.questionCount} q · ${fmtMarks(e.totalMarks)} marks`],
  ]
  return (
    <section aria-labelledby="focus-title" className="relative isolate overflow-hidden rounded-xl border bg-surface shadow-panel">
      <span className="absolute inset-x-0 top-0 h-0.5 bg-primary" aria-hidden />
      <BubbleField rows={7} groups={2} seed={21} className="absolute -right-6 -bottom-6 -z-10 text-brand-text/[0.09]" />
      <div className="grid gap-5 p-5 sm:p-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
        <div className="min-w-0">
          <div className="mb-3 flex items-center gap-2">
            <Status e={e} />
            <span className="eyebrow text-muted-foreground">Up next</span>
          </div>
          <h2 id="focus-title" className="font-display text-2xl font-semibold tracking-tight sm:text-[1.75rem]">
            {e.title}
          </h2>
          <dl className="mt-4 grid max-w-xl grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border text-sm sm:grid-cols-3">
            {facts.map(([Icon, k, v]) => (
              <div key={k} className="bg-surface px-3 py-2.5">
                <dt className="eyebrow flex items-center gap-1 text-muted-foreground">
                  <Icon className="size-3" aria-hidden />
                  {k}
                </dt>
                <dd className="mt-1 font-medium">{v}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link href={href} className={buttonVariants({ size: "lg", variant: a.kind === "upcoming" ? "outline" : "default" })}>
              {a.kind === "resume" && <PlayCircle />}
              {a.kind === "resume" ? "Resume exam" : a.kind === "open" ? "Read instructions and start" : "Read instructions"}
              {a.kind !== "resume" && <ArrowRight />}
            </Link>
          </div>
        </div>
        {a.kind === "upcoming" && (
          <div className="relative mx-auto grid size-40 place-items-center">
            <ClockDial className="absolute inset-0 size-full text-border-strong" />
            <div className="text-center">
              <p className="eyebrow text-muted-foreground">Opens in</p>
              <Countdown to={a.opensAt.toISOString()} className="mt-1 block font-mono text-lg font-semibold tabular-nums" />
            </div>
          </div>
        )}
      </div>
      {a.kind === "resume" && (
        <p className="border-t bg-time-soft px-6 py-2.5 text-sm text-time-text sm:px-7">
          Your timer is running on the server. Resume to continue where you left off; saved answers are waiting.
        </p>
      )}
    </section>
  )
}

function Row({ e }: { e: Item }) {
  const a = e.access
  const href =
    a.kind === "resume"
      ? `/attempt/${a.attemptId}`
      : a.kind === "submitted"
        ? `/candidate/results/${a.attemptId}`
        : a.kind === "closed"
          ? null
          : `/candidate/exams/${e.id}`
  const action =
    a.kind === "resume" ? "Resume" : a.kind === "open" ? "Start" : a.kind === "upcoming" ? "Instructions" : a.kind === "submitted" ? (e.resultsPublishedAt ? "View result" : "My answers") : null
  return (
    <li className="relative flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        {href ? (
          <Link href={href} className="font-medium after:absolute after:inset-0 after:content-['']">
            {e.title}
          </Link>
        ) : (
          <span className="font-medium">{e.title}</span>
        )}
        <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <span>{fmtDateTime(e.startsAt)}</span>
          <span>{fmtDuration(e.durationMin)}</span>
          <span>{fmtMarks(e.totalMarks)} marks</span>
        </p>
      </div>
      <div className="flex items-center gap-3">
        <Status e={e} />
        {action && (
          <span className="inline-flex w-28 items-center justify-end gap-1 text-sm font-medium whitespace-nowrap text-brand-text">
            {action}
            <ArrowRight className="size-3.5" aria-hidden />
          </span>
        )}
      </div>
    </li>
  )
}

function Group({ title, items, icon }: { title: string; items: Item[]; icon: typeof Lock }) {
  if (!items.length) return null
  return (
    <Panel className="overflow-hidden" aria-label={title}>
      <CardTitle icon={icon} title={title} meta={items.length} />
      <ul className="divide-y">
        {items.map((e) => (
          <Row key={e.id} e={e} />
        ))}
      </ul>
    </Panel>
  )
}

const GUIDE = [
  { icon: Timer, title: "The server keeps time", body: "Your deadline is set when you start. Closing the tab or changing your clock does not stop or change it." },
  { icon: CloudOff, title: "Answers survive outages", body: "Each answer is kept on your device first and synced. Keep working if the connection drops." },
  { icon: Flag, title: "Flag and review", body: "Mark any question for review, filter unanswered ones, and check everything before you submit." },
  { icon: ShieldCheck, title: "Verifiable results", body: "Your result PDF carries a code and QR anyone can use to confirm it is genuine." },
]

export default async function CandidateHome() {
  const actor = await requirePageRole("candidate")
  const { exams, results, counts } = await getCandidateDashboard(actor)
  const focus = pickFocus(exams)
  const rest = exams.filter((e) => e !== focus)
  const now = rest.filter((e) => e.access.kind === "open" || e.access.kind === "resume")
  const upcoming = rest.filter((e) => e.access.kind === "upcoming")
  const done = rest.filter((e) => e.access.kind === "submitted" || e.access.kind === "closed").reverse()
  const first = actor.name.split(" ")[0]
  const fa = focus?.access
  const awaiting = exams.filter((e) => e.access.kind === "submitted" && !e.resultsPublishedAt).length
  const best = results.length ? Math.max(...results.map((r) => r.percent)) : null
  const today = new Date()

  const summary =
    fa?.kind === "resume"
      ? `${focus!.title} is in progress. Your timer is running on the server; resume to continue.`
      : fa?.kind === "open"
        ? `${focus!.title} is open now. Read the instructions, then start when you are ready.`
        : fa?.kind === "upcoming"
          ? `Next up: ${focus!.title}, opening ${fmtDateTime(fa.opensAt)}.`
          : exams.length
            ? "Nothing is open or scheduled right now."
            : "When your examiner enrolls you, your exams appear here."

  return (
    <>
      <DashHeader
        eyebrow={`${todayLabel(today)} · Candidate desk`}
        title={`${greeting(today)}, ${first}`}
        status={summary}
        pulse={fa?.kind === "resume" || fa?.kind === "open" ? "live" : fa ? "attention" : "idle"}
        actions={
          <>
            <Link href="/candidate/preferences" className={buttonVariants({ variant: "outline", size: "lg" })}>
              <SlidersHorizontal />
              Exam preferences
            </Link>
            <Link href="/candidate/results" className={buttonVariants({ size: "lg" })}>
              <Award />
              My results
            </Link>
          </>
        }
      />

      <KpiGrid
        items={[
          { label: "Open now", value: counts.open, hint: counts.open ? "Ready to start or resume" : "Nothing open", icon: PlayCircle, tone: "success", live: counts.open > 0 },
          { label: "Upcoming", value: counts.upcoming, hint: fa?.kind === "upcoming" ? `Next: ${focus!.title}` : "Nothing scheduled", icon: CalendarClock, tone: "info" },
          { label: "Completed", value: counts.completed, hint: awaiting ? `${awaiting} awaiting results` : "All results published", icon: FileCheck2, tone: "brand", href: "/candidate/results" },
          {
            label: "Average score",
            value: counts.average === null ? "None" : `${counts.average}%`,
            hint: results.length ? `${results.length} published · best ${best}%` : "Appears after publication",
            icon: Target,
            tone: "time",
            meter: counts.average ?? 0,
            href: "/candidate/results",
          },
        ]}
      />

      {!exams.length ? (
        <Empty className="rounded-xl border bg-surface py-16">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ClipboardList />
            </EmptyMedia>
            <EmptyTitle>No exams assigned yet</EmptyTitle>
            <EmptyDescription>When your examiner enrolls you, your exams appear here with their schedule.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="grid gap-5 lg:grid-cols-3">
          <div className="flex min-w-0 flex-col gap-5 lg:col-span-2">
            {focus && <Focus e={focus} />}
            <Group title="Also open now" items={now} icon={PlayCircle} />
            <Group title="Upcoming" items={upcoming} icon={Lock} />
            <Group title="Completed" items={done} icon={FileCheck2} />
          </div>

          <aside className="flex min-w-0 flex-col gap-5">
            <Panel className="overflow-hidden">
              <CardTitle icon={TrendingUp} title="Score history" meta={results.length} href="/candidate/results" linkLabel="Transcript" />
              {results.length ? (
                <>
                  {results.length > 1 && (
                    <div className="border-b px-5 pt-4 pb-2 text-brand-text">
                      <Sparkline values={results.map((r) => r.percent)} label={`Scores over time: ${results.map((r) => r.percent + "%").join(", ")}`} />
                    </div>
                  )}
                  <ul className="flex flex-col gap-4 p-5">
                    {results.map((r) => (
                      <li key={r.id}>
                        <Link href={`/candidate/results/${r.attemptId}`} className="group block">
                          <span className="flex items-baseline justify-between gap-3 text-sm">
                            <span className="truncate font-medium group-hover:underline">{r.title}</span>
                            <span className="font-display shrink-0 font-semibold tabular-nums">{r.percent}%</span>
                          </span>
                          <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
                            <span className={cn("block h-full rounded-full", r.percent >= 70 ? "bg-success" : r.percent >= 50 ? "bg-primary" : "bg-time")} style={{ width: `${r.percent}%` }} />
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="px-5 py-6 text-sm text-muted-foreground">Scores appear here once your examiners publish results.</p>
              )}
            </Panel>

            <Panel className="overflow-hidden">
              <CardTitle icon={ShieldCheck} title="Your exam guarantees" />
              <ol className="flex flex-col gap-4 p-5 text-sm">
                {GUIDE.map((g, i) => (
                  <li key={g.title} className="relative flex gap-3">
                    {i < GUIDE.length - 1 && <span className="absolute top-8 bottom-[-1rem] left-[0.85rem] w-px bg-border" aria-hidden />}
                    <span className="relative grid size-7 shrink-0 place-items-center rounded-full border bg-surface text-brand-text shadow-xs">
                      <g.icon className="size-3.5" aria-hidden />
                    </span>
                    <span>
                      <span className="block font-medium">{g.title}</span>
                      <span className="text-muted-foreground">{g.body}</span>
                    </span>
                  </li>
                ))}
              </ol>
              <div className="border-t bg-surface-sunken/50 px-5 py-3">
                <Link href="/verify" className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-text hover:underline">
                  <ShieldCheck className="size-4" aria-hidden />
                  Verify a result report
                </Link>
              </div>
            </Panel>
          </aside>
        </div>
      )}
    </>
  )
}
