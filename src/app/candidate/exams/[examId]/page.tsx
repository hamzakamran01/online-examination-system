import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Award, CalendarClock, Clock, ListChecks, ShieldCheck, WifiOff } from "lucide-react"
import { requirePageRole } from "@/server/auth/guards"
import { getCandidateLobby } from "@/server/services/attempts"
import { AppError } from "@/server/errors"
import { fmtDateTime, fmtDuration, fmtMarks } from "@/lib/format"
import { PageHeader, Panel } from "@/components/shell/page-header"
import { StartExam } from "@/features/attempts/start-exam"

export const metadata: Metadata = { title: "Exam lobby" }

export default async function LobbyPage({ params }: PageProps<"/candidate/exams/[examId]">) {
  const actor = await requirePageRole("candidate")
  const { examId } = await params
  const exam = await getCandidateLobby(actor, examId).catch((e) => {
    if (e instanceof AppError && e.code === "NOT_FOUND") notFound()
    throw e
  })

  return (
    <div className="max-w-3xl">
      <PageHeader title={exam.title} back={{ href: "/candidate", label: "My exams" }} />
      <div className="space-y-6">
        <Panel className="grid grid-cols-2 gap-4 p-5 text-sm sm:grid-cols-4">
          {[
            [CalendarClock, "Window", `${fmtDateTime(exam.startsAt)} to ${fmtDateTime(exam.endsAt)}`],
            [Clock, "Duration", fmtDuration(exam.durationMin)],
            [ListChecks, "Questions", String(exam.questionCount)],
            [Award, "Total marks", fmtMarks(exam.totalMarks)],
          ].map(([Icon, k, v]) => {
            const I = Icon as typeof Clock
            return (
              <div key={k as string} className={k === "Window" ? "col-span-2 sm:col-span-1" : undefined}>
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <I className="size-3.5" aria-hidden />
                  {k as string}
                </p>
                <p className="mt-0.5 font-medium">{v as string}</p>
              </div>
            )
          })}
        </Panel>

        <Panel className="p-5 sm:p-6">
          <h2 className="mb-2 font-semibold">Instructions</h2>
          <p className="text-sm whitespace-pre-wrap text-muted-foreground">{exam.instructions || "No special instructions."}</p>
        </Panel>

        <Panel className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
          <div className="flex gap-3">
            <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
            <p className="text-sm">
              <span className="font-medium">The clock runs on the server.</span>{" "}
              <span className="text-muted-foreground">Once you start, the timer keeps running even if you close the tab or lose power.</span>
            </p>
          </div>
          <div className="flex gap-3">
            <WifiOff className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
            <p className="text-sm">
              <span className="font-medium">Answers save as you go.</span>{" "}
              <span className="text-muted-foreground">If the connection drops, keep working. Answers sync when you reconnect, before the deadline.</span>
            </p>
          </div>
        </Panel>

        <StartExam examId={exam.id} access={exam.access.kind} attemptId={"attemptId" in exam.access ? exam.access.attemptId : undefined} minutes={exam.minutesAvailable} fullMinutes={exam.durationMin} />
      </div>
    </div>
  )
}
