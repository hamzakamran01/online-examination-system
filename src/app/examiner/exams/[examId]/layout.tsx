import { notFound } from "next/navigation"
import { CalendarClock, Clock, Award } from "lucide-react"
import { requirePageRole } from "@/server/auth/guards"
import { getManagedExam } from "@/server/services/exams"
import { AppError } from "@/server/errors"
import { effectiveStatus } from "@/lib/domain/exam-status"
import { fmtDateTime, fmtDuration, fmtMarks } from "@/lib/format"
import { PageHeader } from "@/components/shell/page-header"
import { ExamStatusBadge } from "@/components/shell/status"
import { ExamTabs } from "@/features/exams/exam-tabs"
import { ExamLifecycleActions } from "@/features/exams/lifecycle-actions"

export default async function ExamLayout({ children, params }: LayoutProps<"/examiner/exams/[examId]">) {
  const actor = await requirePageRole("examiner")
  const { examId } = await params
  const exam = await getManagedExam(actor, examId).catch((e) => {
    if (e instanceof AppError && e.code === "NOT_FOUND") notFound()
    throw e
  })
  const status = effectiveStatus(exam)

  return (
    <>
      <PageHeader
        back={{ href: "/examiner", label: "Exams" }}
        eyebrow={<ExamStatusBadge status={status} />}
        title={exam.title}
        description={
          <span className="flex flex-wrap gap-x-4 gap-y-1">
            <span className="inline-flex items-center gap-1.5">
              <CalendarClock className="size-4" aria-hidden />
              {fmtDateTime(exam.startsAt)} to {fmtDateTime(exam.endsAt)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock className="size-4" aria-hidden />
              {fmtDuration(exam.durationMin)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Award className="size-4" aria-hidden />
              {fmtMarks(exam.totalMarks)} marks
            </span>
          </span>
        }
        actions={<ExamLifecycleActions examId={exam.id} status={status} />}
        className="mb-6"
      />
      <ExamTabs examId={exam.id} />
      <div className="pt-6">{children}</div>
    </>
  )
}
