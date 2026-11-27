import type { Metadata } from "next"
import { requirePageRole } from "@/server/auth/guards"
import { listTopics } from "@/server/services/questions"
import { PageHeader } from "@/components/shell/page-header"
import { QuestionForm } from "@/features/questions/question-form"

export const metadata: Metadata = { title: "New question" }

export default async function NewQuestionPage() {
  const actor = await requirePageRole("examiner")
  const topics = await listTopics(actor)
  return (
    <div className="max-w-3xl">
      <PageHeader title="New question" back={{ href: "/examiner/bank", label: "Question bank" }} />
      <QuestionForm topics={topics.map((t) => t.name)} />
    </div>
  )
}
