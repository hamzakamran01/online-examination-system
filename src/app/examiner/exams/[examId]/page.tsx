import { Info } from "lucide-react"
import { requirePageRole } from "@/server/auth/guards"
import { getManagedExam } from "@/server/services/exams"
import { ExamForm } from "@/features/exams/exam-form"

export default async function ExamSettingsPage({ params }: PageProps<"/examiner/exams/[examId]">) {
  const actor = await requirePageRole("examiner")
  const { examId } = await params
  const exam = await getManagedExam(actor, examId)
  const locked = exam.status !== "draft"

  return (
    <div className="max-w-3xl space-y-4">
      {locked && (
        <p className="flex gap-2 rounded-lg border border-info/30 bg-info-soft p-3 text-sm text-info-text">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          Settings are locked once an exam is published, so every candidate sits the same exam. Unpublish it (only possible before anyone starts) to make changes.
        </p>
      )}
      <ExamForm
        disabled={locked}
        initial={{
          id: exam.id,
          title: exam.title,
          instructions: exam.instructions,
          startsAt: exam.startsAt.toISOString(),
          endsAt: exam.endsAt.toISOString(),
          durationMin: exam.durationMin,
          totalMarks: exam.totalMarks,
          passMark: exam.passMark,
          shuffleQuestions: exam.shuffleQuestions,
          shuffleOptions: exam.shuffleOptions,
          releaseAnswerReview: exam.releaseAnswerReview,
        }}
      />
    </div>
  )
}
