import type { Metadata } from "next"
import { requirePageRole } from "@/server/auth/guards"
import { PageHeader } from "@/components/shell/page-header"
import { ExamForm } from "@/features/exams/exam-form"

export const metadata: Metadata = { title: "New exam" }

export default async function NewExamPage() {
  await requirePageRole("examiner")
  return (
    <div className="max-w-3xl">
      <PageHeader
        title="New exam"
        description="Start with the basics. You will add questions, enroll candidates and review everything before publishing."
        back={{ href: "/examiner/exams", label: "Exams" }}
      />
      <ExamForm />
    </div>
  )
}
