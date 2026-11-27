import type { Metadata } from "next"
import Link from "next/link"
import { CalendarClock, CheckCircle2, ClipboardList, Clock, Hourglass, Lock, PlayCircle } from "lucide-react"
import { requirePageRole } from "@/server/auth/guards"
import { listCandidateExams } from "@/server/services/attempts"
import { PageHeader, SectionLabel } from "@/components/shell/page-header"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { fmtDateTime, fmtDuration, fmtMarks } from "@/lib/format"
import { cn } from "@/lib/utils"

export const metadata: Metadata = { title: "My exams" }

type Item = Awaited<ReturnType<typeof listCandidateExams>>[number]

function kindBadge(kind: Item["access"]["kind"]) {
  if (kind === "open") return <Badge variant="success">Open now</Badge>
  if (kind === "resume") return <Badge variant="warning">In progress</Badge>
  if (kind === "upcoming") return <Badge variant="info">Upcoming</Badge>
  if (kind === "submitted") return <Badge variant="secondary">Submitted</Badge>
  return <Badge variant="muted">Missed</Badge>
}

function kindStripe(kind: Item["access"]["kind"]) {
  if (kind === "open") return "shadow-[inset_3px_0_0_0_var(--success)]"
  if (kind === "resume") return "shadow-[inset_3px_0_0_0_var(--warning)]"
  if (kind === "upcoming") return "shadow-[inset_3px_0_0_0_var(--info)]"
  if (kind === "submitted") return "shadow-[inset_3px_0_0_0_var(--primary)]"
  return "shadow-[inset_3px_0_0_0_var(--border)]"
}

function ExamCard({ e, featured }: { e: Item; featured?: boolean }) {
  const a = e.access
  return (
    <li
      className={cn(
        "flex flex-col gap-4 rounded-lg border bg-paper p-5 shadow-panel",
        kindStripe(a.kind),
        featured && "md:col-span-2 md:flex-row md:items-end md:justify-between md:p-7"
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <h3 className={cn("font-heading font-medium", featured ? "text-2xl" : "text-lg")}>{e.title}</h3>
          {kindBadge(a.kind)}
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <div className="col-span-2 flex items-center gap-2 text-muted-foreground">
            <CalendarClock className="size-4 shrink-0" aria-hidden />
            <span>
              <span className="sr-only">Window: </span>
              {fmtDateTime(e.startsAt)} to {fmtDateTime(e.endsAt)}
            </span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="size-4" aria-hidden />
            {fmtDuration(e.durationMin)}
          </div>
          <div className="text-muted-foreground">
            {e.questionCount} questions · {fmtMarks(e.totalMarks)} marks
          </div>
        </dl>
      </div>
      <div className={cn("mt-auto", featured && "md:mt-0 md:shrink-0")}>
        {a.kind === "open" && (
          <Link href={`/candidate/exams/${e.id}`} className={cn(buttonVariants({ size: "lg" }), "w-full sm:w-auto")}>
            <PlayCircle />
            View instructions and start
          </Link>
        )}
        {a.kind === "resume" && (
          <Link href={`/attempt/${a.attemptId}`} className={cn(buttonVariants({ size: "lg" }), "w-full sm:w-auto")}>
            <PlayCircle />
            Resume exam
          </Link>
        )}
        {a.kind === "upcoming" && (
          <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Lock className="size-4" aria-hidden />
            Opens {fmtDateTime(a.opensAt)}.{" "}
            <Link href={`/candidate/exams/${e.id}`} className="font-medium text-primary hover:underline">
              Read instructions
            </Link>
          </p>
        )}
        {a.kind === "submitted" && (
          <div className="flex flex-col gap-3">
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="size-4 text-success-text" aria-hidden />
              {e.resultsPublishedAt ? "Your result is published." : "Submitted. Your score appears once your examiner publishes results."}
            </p>
            <Link
              href={`/candidate/results/${a.attemptId}`}
              className={cn(buttonVariants({ variant: e.resultsPublishedAt ? "default" : "outline" }), "w-full sm:w-auto")}
            >
              {e.resultsPublishedAt ? "View result" : "View my answers"}
            </Link>
          </div>
        )}
        {a.kind === "closed" && <p className="text-sm text-muted-foreground">The window closed before you started.</p>}
      </div>
    </li>
  )
}

function Group({ title, hint, icon: Icon, items }: { title: string; hint: string; icon: typeof Hourglass; items: Item[] }) {
  return (
    <section aria-labelledby={`h-${title}`}>
      <div className="mb-3 flex items-center gap-2">
        <Icon className="size-4 text-muted-foreground" aria-hidden />
        <h2 id={`h-${title}`} className="font-heading text-lg font-medium">
          {title} <span className="font-sans text-sm font-normal text-muted-foreground">({items.length})</span>
        </h2>
      </div>
      {items.length ? (
        <ul className="grid gap-3 md:grid-cols-2">
          {items.map((e) => (
            <ExamCard key={e.id} e={e} />
          ))}
        </ul>
      ) : (
        <p className="rounded-lg border border-dashed px-5 py-6 text-sm text-muted-foreground">{hint}</p>
      )}
    </section>
  )
}

export default async function CandidateHome() {
  const actor = await requirePageRole("candidate")
  const exams = await listCandidateExams(actor)
  const available = exams.filter((e) => e.access.kind === "open" || e.access.kind === "resume")
  const upcoming = exams.filter((e) => e.access.kind === "upcoming")
  const completed = exams.filter((e) => e.access.kind === "submitted" || e.access.kind === "closed").reverse()
  const featured = available[0]
  const restAvailable = available.slice(1)

  return (
    <>
      <PageHeader
        eyebrow={<span className="kicker">Candidate desk</span>}
        title={`${actor.name.split(" ")[0]}, your papers`}
        description="Exams you are enrolled in. Times are shown in your local timezone. Open or in-progress papers sit at the top."
      />
      {!exams.length ? (
        <Empty className="rounded-lg border bg-paper py-16">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ClipboardList />
            </EmptyMedia>
            <EmptyTitle>No exams assigned yet</EmptyTitle>
            <EmptyDescription>When your examiner enrolls you, exams appear here with their schedule.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="flex flex-col gap-10">
          {featured && (
            <section aria-labelledby="h-now">
              <SectionLabel hint="Start or continue here first">Needs your attention</SectionLabel>
              <ul className="grid gap-3">
                <ExamCard e={featured} featured />
              </ul>
              {restAvailable.length > 0 && (
                <ul className="mt-3 grid gap-3 md:grid-cols-2">
                  {restAvailable.map((e) => (
                    <ExamCard key={e.id} e={e} />
                  ))}
                </ul>
              )}
            </section>
          )}
          {!featured && <Group title="Available now" hint="Nothing is open right now." icon={PlayCircle} items={[]} />}
          <Group title="Upcoming" hint="No upcoming exams." icon={Hourglass} items={upcoming} />
          <Group title="Completed" hint="Completed exams will appear here." icon={CheckCircle2} items={completed} />
        </div>
      )}
    </>
  )
}
