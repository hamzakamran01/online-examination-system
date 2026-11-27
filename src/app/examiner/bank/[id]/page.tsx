import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { requirePageRole } from "@/server/auth/guards"
import { getQuestion, listTopics } from "@/server/services/questions"
import { AppError } from "@/server/errors"
import { PageHeader } from "@/components/shell/page-header"
import { QuestionForm } from "@/features/questions/question-form"

export const metadata: Metadata = { title: "Edit question" }

export default async function EditQuestionPage({ params }: PageProps<"/examiner/bank/[id]">) {
  const actor = await requirePageRole("examiner")
  const { id } = await params
  const q = await getQuestion(actor, id).catch((e) => {
    if (e instanceof AppError && e.code === "NOT_FOUND") notFound()
    throw e
  })
  if (q.ownerId !== actor.id) notFound()
  const topics = await listTopics(actor)
  return (
    <div className="max-w-3xl">
      <PageHeader title="Edit question" back={{ href: "/examiner/bank", label: "Question bank" }} />
      <QuestionForm
        topics={topics.map((t) => t.name)}
        initial={{
          id: q.id,
          type: q.type,
          stem: q.stem,
          topicName: q.topicName,
          difficulty: q.difficulty,
          defaultMarks: q.defaultMarks,
          multiScheme: q.multiScheme,
          rubric: q.rubric ?? "",
          options: q.options.map((o) => ({ text: o.text, isCorrect: o.isCorrect })),
        }}
      />
    </div>
  )
}
