import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight, CalendarClock, ClipboardList, Plus, Users } from "lucide-react"
import { requirePageRole } from "@/server/auth/guards"
import { listManagedExams } from "@/server/services/exams"
import { PageHeader, SectionLabel, Stat } from "@/components/shell/page-header"
import { ExamStatusBadge } from "@/components/shell/status"
import { buttonVariants } from "@/components/ui/button"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { fmtDateTime, fmtDuration, fmtMarks } from "@/lib/format"
import type { EffectiveStatus } from "@/lib/domain/exam-status"

export const metadata: Metadata = { title: "Exams" }

const GROUPS: { key: EffectiveStatus; title: string; hint: string }[] = [
  { key: "ongoing", title: "Ongoing", hint: "Window is open now" },
  { key: "published", title: "Scheduled", hint: "Published and waiting to open" },
  { key: "draft", title: "Drafts", hint: "Only you can see these" },
  { key: "completed", title: "Completed", hint: "Window closed: grade and publish results" },
]

const stripe: Record<EffectiveStatus, string> = {
  ongoing: "shadow-[inset_3px_0_0_0_var(--success)]",
  published: "shadow-[inset_3px_0_0_0_var(--info)]",
  draft: "shadow-[inset_3px_0_0_0_var(--border)]",
  completed: "shadow-[inset_3px_0_0_0_var(--primary)]",
}

export default async function ExaminerHome() {
  const actor = await requirePageRole("examiner")
  const exams = await listManagedExams(actor)
  const active = exams.reduce((s, e) => s + e.activeCount, 0)

  return (
    <>
      <PageHeader
        eyebrow={<span className="kicker">Examiner desk</span>}
        title="Examination board"
        description={`${actor.name.split(" ").slice(0, 2).join(" ")}. Papers grouped by lifecycle. Live sittings come first.`}
        actions={
          <Link href="/examiner/exams/new" className={buttonVariants()}>
            <Plus />
            New exam
          </Link>
        }
      />
      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Ongoing exams" value={exams.filter((e) => e.effective === "ongoing").length} tone="success" />
        <Stat label="Candidates writing now" value={active} hint="Active attempts" />
        <Stat label="Scheduled" value={exams.filter((e) => e.effective === "published").length} />
        <Stat label="Drafts" value={exams.filter((e) => e.effective === "draft").length} />
      </div>

      {!exams.length ? (
        <Empty className="rounded-lg border bg-paper py-16">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ClipboardList />
            </EmptyMedia>
            <EmptyTitle>No exams yet</EmptyTitle>
            <EmptyDescription>Create a draft, add questions from your bank, then publish when the review checklist is green.</EmptyDescription>
          </EmptyHeader>
          <Link href="/examiner/exams/new" className={buttonVariants()}>
            Create your first exam
          </Link>
        </Empty>
      ) : (
        <div className="flex flex-col gap-8">
          {GROUPS.map((g) => {
            const list = exams.filter((e) => e.effective === g.key)
            if (!list.length) return null
            return (
              <section key={g.key} aria-labelledby={`g-${g.key}`}>
                <SectionLabel hint={g.hint}>
                  <span id={`g-${g.key}`}>{g.title}</span>
                </SectionLabel>
                <ul className="grid gap-3 md:grid-cols-2">
                  {list.map((e) => (
                    <li key={e.id}>
                      <Link
                        href={`/examiner/exams/${e.id}`}
                        className={`group flex h-full flex-col gap-3 rounded-lg border bg-paper p-5 shadow-panel transition-colors hover:border-primary/35 ${stripe[e.effective]}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <p className="font-heading text-lg font-medium group-hover:text-primary">{e.title}</p>
                          <ExamStatusBadge status={e.effective} />
                        </div>
                        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                          <CalendarClock className="size-4" aria-hidden />
                          {fmtDateTime(e.startsAt)} to {fmtDateTime(e.endsAt)}
                        </p>
                        <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          <span>{fmtDuration(e.durationMin)}</span>
                          <span>{e.questionCount} questions</span>
                          <span>{fmtMarks(e.totalMarks)} marks</span>
                          <span className="inline-flex items-center gap-1">
                            <Users className="size-3.5" aria-hidden />
                            {e.enrolledCount} enrolled
                          </span>
                          {e.effective === "ongoing" && <span className="font-medium text-success-text">{e.activeCount} writing now</span>}
                          {e.submittedCount > 0 && <span>{e.submittedCount} submitted</span>}
                          <ArrowRight className="ml-auto size-4 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )
          })}
        </div>
      )}
    </>
  )
}
