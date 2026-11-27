import type { Metadata } from "next"
import Link from "next/link"
import { CalendarClock, CheckCircle2, ClipboardList, Clock, Hourglass, Lock, PlayCircle } from "lucide-react"
import { requirePageRole } from "@/server/auth/guards"
import { listCandidateExams } from "@/server/services/attempts"
import { PageHeader } from "@/components/shell/page-header"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { fmtDateTime, fmtDuration, fmtMarks } from "@/lib/format"
import { cn } from "@/lib/utils"

export const metadata: Metadata = { title: "My exams" }

type Item = Awaited<ReturnType<typeof listCandidateExams>>[number]

function ExamCard({ e }: { e: Item }) {
  const a = e.access
  return (
    <li className="flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-panel">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-medium">{e.title}</h3>
        {a.kind === "open" && <Badge variant="success">Open now</Badge>}
        {a.kind === "resume" && <Badge variant="warning">In progress</Badge>}
        {a.kind === "upcoming" && <Badge variant="info">Upcoming</Badge>}
        {a.kind === "submitted" && <Badge variant="secondary">Submitted</Badge>}
        {a.kind === "closed" && <Badge variant="muted">Missed</Badge>}
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
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
      <div className="mt-auto">
        {a.kind === "open" && (
          <Link href={`/candidate/exams/${e.id}`} className={cn(buttonVariants(), "w-full sm:w-auto")}>
            <PlayCircle />
            View instructions and start
          </Link>
        )}
        {a.kind === "resume" && (
          <Link href={`/attempt/${a.attemptId}`} className={cn(buttonVariants(), "w-full sm:w-auto")}>
            <PlayCircle />
            Resume exam
          </Link>
        )}
        {a.kind === "upcoming" && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Lock className="size-4" aria-hidden />
            Opens {fmtDateTime(a.opensAt)}.{" "}
            <Link href={`/candidate/exams/${e.id}`} className="font-medium text-primary hover:underline">
              Read instructions
            </Link>
          </p>
        )}
        {a.kind === "submitted" && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className="size-4 text-success-text" aria-hidden />
            {e.resultsPublishedAt ? "Results are published." : "Submitted. Results appear here once your examiner publishes them."}
          </p>
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
        <h2 id={`h-${title}`} className="font-semibold">
          {title} <span className="font-normal text-muted-foreground">({items.length})</span>
        </h2>
      </div>
      {items.length ? (
        <ul className="grid gap-3 md:grid-cols-2">
          {items.map((e) => (
            <ExamCard key={e.id} e={e} />
          ))}
        </ul>
      ) : (
        <p className="rounded-xl border border-dashed px-5 py-6 text-sm text-muted-foreground">{hint}</p>
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

  return (
    <>
      <PageHeader title={`Hello, ${actor.name.split(" ")[0]}`} description="Exams you are enrolled in. Times are shown in your local timezone." />
      {!exams.length ? (
        <Empty className="rounded-xl border bg-card py-16">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ClipboardList />
            </EmptyMedia>
            <EmptyTitle>No exams assigned yet</EmptyTitle>
            <EmptyDescription>When your examiner enrolls you, exams appear here with their schedule.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="space-y-10">
          <Group title="Available now" hint="Nothing is open right now." icon={PlayCircle} items={available} />
          <Group title="Upcoming" hint="No upcoming exams." icon={Hourglass} items={upcoming} />
          <Group title="Completed" hint="Completed exams will appear here." icon={CheckCircle2} items={completed} />
        </div>
      )}
    </>
  )
}
