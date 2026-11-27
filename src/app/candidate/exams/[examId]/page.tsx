import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Award, CalendarClock, Clock, ListChecks, ShieldCheck, WifiOff } from "lucide-react"
import { requirePageRole } from "@/server/auth/guards"
import { getCandidateLobby } from "@/server/services/attempts"
import { AppError } from "@/server/errors"
import { fmtDateTime, fmtDuration, fmtMarks } from "@/lib/format"
import { PageHeader, Panel, PanelHeader } from "@/components/shell/page-header"
import { BubbleField, GuillocheBand } from "@/components/shell/decor"
import { cn } from "@/lib/utils"
import { StartExam } from "@/features/attempts/start-exam"

export const metadata: Metadata = { title: "Exam lobby" }

export default async function LobbyPage({ params }: PageProps<"/candidate/exams/[examId]">) {
  const actor = await requirePageRole("candidate")
  const { examId } = await params
  const exam = await getCandidateLobby(actor, examId).catch((e) => {
    if (e instanceof AppError && e.code === "NOT_FOUND") notFound()
    throw e
  })

  const facts: [typeof Clock, string, string][] = [
    [CalendarClock, "Window", `${fmtDateTime(exam.startsAt)} to ${fmtDateTime(exam.endsAt)}`],
    [Clock, "Duration", fmtDuration(exam.durationMin)],
    [ListChecks, "Questions", String(exam.questionCount)],
    [Award, "Total marks", fmtMarks(exam.totalMarks)],
  ]

  return (
    <>
      <PageHeader title={exam.title} back={{ href: "/candidate", label: "My exams" }} eyebrow={<span className="eyebrow text-brand-text">Examination lobby</span>} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-6">
          {/* Admission ticket: printed-paper treatment so the lobby reads as an official sitting. */}
          <Panel className="relative isolate overflow-hidden">
            <GuillocheBand className="h-3 text-brand-text/45" />
            <BubbleField rows={6} groups={2} seed={9} className="absolute top-5 right-28 -z-10 hidden text-brand-text/[0.12] sm:block" />
            <div className="flex flex-wrap items-end justify-between gap-3 border-b px-5 pt-4 pb-4 sm:px-6">
              <div>
                <p className="eyebrow text-muted-foreground">Admission for</p>
                <p className="font-display mt-1 text-lg font-semibold">{actor.name}</p>
              </div>
              <p className="font-mono text-xs text-subtle-foreground">REF {exam.id.slice(0, 8).toUpperCase()}</p>
            </div>
            <dl className="grid grid-cols-2 gap-px bg-border sm:grid-cols-4">
              {facts.map(([I, k, v]) => (
                <div key={k} className={cn("bg-surface px-5 py-4 sm:px-6", k === "Window" && "col-span-2 sm:col-span-1")}>
                  <dt className="eyebrow flex items-center gap-1.5 text-muted-foreground">
                    <I className="size-3.5" aria-hidden />
                    {k}
                  </dt>
                  <dd className={cn("mt-1.5 font-medium", k !== "Window" && "font-display text-xl tabular-nums")}>{v}</dd>
                </div>
              ))}
            </dl>
          </Panel>

          <Panel>
            <PanelHeader title="Instructions" description="Read these before you start. The clock does not run while you are here." />
            <p className="px-5 py-4 text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground sm:px-6">{exam.instructions || "No special instructions."}</p>
          </Panel>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start" aria-label="Before you begin">
          <Panel className="divide-y">
            {[
              [ShieldCheck, "The clock runs on the server.", "Once you start, the timer keeps running even if you close the tab or lose power."],
              [WifiOff, "Answers save as you go.", "If the connection drops, keep working. Answers sync when you reconnect, before the deadline."],
            ].map(([I, t, b]) => {
              const Icon = I as typeof Clock
              return (
                <div key={t as string} className="flex gap-3 p-4">
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand-text">
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <p className="text-sm">
                    <span className="block font-medium">{t as string}</span>
                    <span className="text-muted-foreground">{b as string}</span>
                  </p>
                </div>
              )
            })}
          </Panel>
          <StartExam examId={exam.id} access={exam.access.kind} attemptId={"attemptId" in exam.access ? exam.access.attemptId : undefined} minutes={exam.minutesAvailable} fullMinutes={exam.durationMin} />
        </aside>
      </div>
    </>
  )
}
