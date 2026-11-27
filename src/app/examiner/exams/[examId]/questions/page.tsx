import { requirePageRole } from "@/server/auth/guards"
import { getExamQuestions, getManagedExam } from "@/server/services/exams"
import { listQuestions, listTopics } from "@/server/services/questions"
import { QuestionPicker } from "@/features/exams/question-picker"

export default async function ExamQuestionsPage({ params }: PageProps<"/examiner/exams/[examId]/questions">) {
  const actor = await requirePageRole("examiner")
  const { examId } = await params
  const [exam, assigned, bank, topics] = await Promise.all([
    getManagedExam(actor, examId),
    getExamQuestions(actor, examId),
    listQuestions(actor),
    listTopics(actor),
  ])
  return (
    <QuestionPicker
      examId={exam.id}
      totalMarks={exam.totalMarks}
      locked={exam.status !== "draft"}
      topics={topics}
      assigned={assigned.map((a) => ({
        questionId: a.questionId,
        marks: a.marks,
        stem: a.stem,
        type: a.type,
        difficulty: a.difficulty,
        topicName: a.topicName,
      }))}
      bank={bank.map((b) => ({
        questionId: b.id,
        marks: b.defaultMarks,
        stem: b.stem,
        type: b.type,
        difficulty: b.difficulty,
        topicName: b.topicName,
        topicId: b.topicId,
      }))}
    />
  )
}
