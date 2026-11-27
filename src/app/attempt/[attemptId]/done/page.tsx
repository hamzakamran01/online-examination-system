import type { Metadata } from "next"
import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { CheckCircle2, FlaskConical } from "lucide-react"
import { requirePageRole } from "@/server/auth/guards"
import { getAttemptStatus } from "@/server/services/attempts"
import { AppError } from "@/server/errors"
import { buttonVariants } from "@/components/ui/button"
import { Logo } from "@/components/shell/logo"
import { fmtDateTime } from "@/lib/format"
import { ClearJournal } from "@/features/attempts/clear-journal"

export const metadata: Metadata = { title: "Submitted" }

export default async function DonePage({ params }: PageProps<"/attempt/[attemptId]/done">) {
  const actor = await requirePageRole("candidate", "examiner")
  const { attemptId } = await params
  const a = await getAttemptStatus(actor, attemptId).catch((e) => {
    if (e instanceof AppError && e.code === "NOT_FOUND") notFound()
    throw e
  })
  if (a.status === "in_progress") redirect(`/attempt/${attemptId}`)
  const back = a.isSandbox ? `/examiner/exams/${a.examId}/review` : "/candidate"

  return (
    <main id="main" className="grid min-h-dvh place-items-center bg-canvas px-4">
      <ClearJournal attemptId={attemptId} />
      <div className="w-full max-w-md space-y-6 rounded-2xl border bg-card p-8 text-center shadow-panel">
        <Logo className="justify-center" />
        <CheckCircle2 className="mx-auto size-12 text-success-text" aria-hidden />
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold">{a.status === "submitted" ? "Exam submitted" : "Time is up: exam submitted"}</h1>
          <p className="text-sm text-muted-foreground">
            Recorded at {fmtDateTime(a.submittedAt)}.{" "}
            {a.status === "auto_submitted" && "Answers saved before the deadline were submitted automatically. "}
            {a.isSandbox ? "" : "Your result appears on your dashboard once your examiner publishes it."}
          </p>
        </div>
        {a.isSandbox && (
          <p className="flex items-center justify-center gap-2 rounded-lg bg-info-soft p-3 text-sm text-info-text">
            <FlaskConical className="size-4" aria-hidden />
            Sandbox attempt: not counted anywhere.
          </p>
        )}
        <Link href={back} className={buttonVariants({ className: "w-full" })}>
          {a.isSandbox ? "Back to exam review" : "Back to my exams"}
        </Link>
      </div>
    </main>
  )
}
