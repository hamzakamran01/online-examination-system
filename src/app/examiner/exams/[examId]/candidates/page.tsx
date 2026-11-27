import { requirePageRole } from "@/server/auth/guards"
import { getManagedExam } from "@/server/services/exams"
import { listEnrollments } from "@/server/services/enrollments"
import { effectiveStatus } from "@/lib/domain/exam-status"
import { EnrollmentManager } from "@/features/exams/enrollment-manager"

export default async function CandidatesPage({ params }: PageProps<"/examiner/exams/[examId]/candidates">) {
  const actor = await requirePageRole("examiner")
  const { examId } = await params
  const [exam, rows] = await Promise.all([getManagedExam(actor, examId), listEnrollments(actor, examId)])
  const now = Date.now()
  return (
    <EnrollmentManager
      examId={exam.id}
      closed={effectiveStatus(exam) === "completed"}
      maxMarks={exam.totalMarks}
      rows={rows.map((r) => ({
        candidateId: r.candidateId,
        name: r.name,
        email: r.email,
        active: r.active,
        state: !r.attemptId
          ? "not_started"
          : r.attemptStatus === "in_progress" && r.deadlineAt && r.deadlineAt.getTime() > now
            ? "in_progress"
            : "submitted",
        score: r.scoreTotal,
        grading: r.gradingStatus,
      }))}
    />
  )
}
