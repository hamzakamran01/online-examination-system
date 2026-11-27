import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight, CalendarClock, CheckCircle2, ClipboardList, Clock, FileCheck2, Lock, PlayCircle } from "lucide-react"
import { requirePageRole } from "@/server/auth/guards"
import { listCandidateExams } from "@/server/services/attempts"
import { PageHeader, SectionTitle } from "@/components/shell/page-header"
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
  return <span className={cn("inline-flex h-6 shrink-0 items-center rounded-full px-2.5 text-xs font-medium", cls)}>{label}</span>
}

/** The single most relevant exam: something to resume, then open, then the next upcoming. */
function pickFocus(items: Item[]) {
  return items.find((e) => e.access.kind === "resume") ?? items.find((e) => e.access.kind === "open") ?? items.find((e) => e.access.kind === "upcoming")
}

function Focus({ e }: { e: Item }) {
  const a = e.access
  return (
    <section aria-labelledby="focus-title" className="mb-10 overflow-hidden rounded-xl border bg-surface">
      <div className="grid gap-6 p-6 sm:p-8 md:grid-cols-[1fr_auto] md:items-center">
        <div className="min-w-0">
          <div className="mb-3 flex items-center gap-2">
            <Status e={e} />
            <span className="text-sm text-muted-foreground">Up next</span>
          </div>
          <h2 id="focus-title" className="font-display text-2xl font-semibold sm:text-[1.75rem]">
            {e.title}
          </h2>
          <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <CalendarClock className="size-4" aria-hidden />
              <dt className="sr-only">Window</dt>
              <dd>
                {fmtDateTime(e.startsAt)} to {fmtDateTime(e.endsAt)}
              </dd>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="size-4" aria-hidden />
              <dt className="sr-only">Duration</dt>
              <dd>{fmtDuration(e.durationMin)}</dd>
            </div>
            <div>
              <dt className="sr-only">Paper</dt>
              <dd>
                {e.questionCount} questions, {fmtMarks(e.totalMarks)} marks
              </dd>
            </div>
          </dl>
        </div>
        <div className="flex flex-col items-start gap-3 md:items-end">
          {a.kind === "upcoming" && (
            <div className="md:text-right">
              <p className="text-xs text-muted-foreground">Opens in</p>
              <Countdown to={a.opensAt.toISOString()} className="font-mono text-2xl font-semibold tabular-nums" />
            </div>
          )}
          {a.kind === "resume" ? (
            <Link href={`/attempt/${a.attemptId}`} className={buttonVariants({ size: "lg" })}>
              <PlayCircle />
              Resume exam
            </Link>
          ) : a.kind === "open" ? (
            <Link href={`/candidate/exams/${e.id}`} className={buttonVariants({ size: "lg" })}>
              Read instructions and start
              <ArrowRight />
            </Link>
          ) : (
            <Link href={`/candidate/exams/${e.id}`} className={buttonVariants({ variant: "outline", size: "lg" })}>
              Read instructions
            </Link>
          )}
        </div>
      </div>
      {a.kind === "resume" && (
        <p className="border-t bg-time-soft px-6 py-2.5 text-sm text-time-text sm:px-8">
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
    <li className="relative flex flex-col gap-3 px-5 py-4 transition-colors hover:bg-muted/40 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          {href ? (
            <Link href={href} className="font-medium after:absolute after:inset-0 after:content-['']">
              {e.title}
            </Link>
          ) : (
            <span className="font-medium">{e.title}</span>
          )}
        </div>
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

function Group({ title, hint, items, icon: Icon }: { title: string; hint: string; items: Item[]; icon: typeof Lock }) {
  if (!items.length) return null
  return (
    <section aria-label={title}>
      <SectionTitle hint={hint}>
        <span className="inline-flex items-center gap-2">
          <Icon className="size-4 text-muted-foreground" aria-hidden />
          {title}
          <span className="text-sm font-normal text-muted-foreground tabular-nums">{items.length}</span>
        </span>
      </SectionTitle>
      <ul className="divide-y overflow-hidden rounded-xl border bg-surface">
        {items.map((e) => (
          <Row key={e.id} e={e} />
        ))}
      </ul>
    </section>
  )
}

export default async function CandidateHome() {
  const actor = await requirePageRole("candidate")
  const exams = await listCandidateExams(actor)
  const focus = pickFocus(exams)
  const rest = exams.filter((e) => e !== focus)
  const now = rest.filter((e) => e.access.kind === "open" || e.access.kind === "resume")
  const upcoming = rest.filter((e) => e.access.kind === "upcoming")
  const done = rest.filter((e) => e.access.kind === "submitted" || e.access.kind === "closed").reverse()
  const published = exams.filter((e) => e.access.kind === "submitted" && e.resultsPublishedAt).length

  return (
    <>
      <PageHeader
        title={`Hello, ${actor.name.split(" ")[0]}`}
        description={
          published
            ? `${published} result${published === 1 ? " is" : "s are"} published. Times are shown in your timezone; deadlines follow the server clock.`
            : "Your examinations. Times are shown in your timezone; deadlines follow the server clock."
        }
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
        <>
          {focus ? (
            <Focus e={focus} />
          ) : (
            <p className="mb-10 flex items-center gap-2 rounded-xl border bg-surface px-5 py-4 text-sm text-muted-foreground">
              <CheckCircle2 className="size-4 text-success-text" aria-hidden />
              Nothing is open or scheduled right now.
            </p>
          )}
          <div className="flex flex-col gap-8">
            <Group title="Also available" hint="Open now" items={now} icon={PlayCircle} />
            <Group title="Upcoming" hint="Instructions are available before the window opens" items={upcoming} icon={Lock} />
            <Group title="Completed" hint="Your answers, and results once published" items={done} icon={FileCheck2} />
          </div>
        </>
      )}
    </>
  )
}
