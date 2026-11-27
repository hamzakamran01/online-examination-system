import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import { requirePageRole } from "@/server/auth/guards"
import { getAttemptView } from "@/server/services/attempts"
import { getPreferences } from "@/server/services/workspace"
import { AppError } from "@/server/errors"
import { ExamWorkspace } from "@/features/attempts/workspace/exam-workspace"

export const metadata: Metadata = { title: "Exam in progress" }

export default async function AttemptPage({ params }: PageProps<"/attempt/[attemptId]">) {
  const actor = await requirePageRole("candidate", "examiner")
  const { attemptId } = await params
  const [view, preferences] = await Promise.all([
    getAttemptView(actor, attemptId).catch((e) => {
      if (e instanceof AppError && e.code === "NOT_FOUND") notFound()
      throw e
    }),
    getPreferences(actor),
  ])
  if (view.status !== "in_progress") redirect(`/attempt/${attemptId}/done`)
  return <ExamWorkspace view={view} preferences={preferences} />
}
