import type { Metadata } from "next"
import Link from "next/link"
import { FilePlus2 } from "lucide-react"
import { requirePageRole } from "@/server/auth/guards"
import { listManagedExams } from "@/server/services/exams"
import { PageHeader } from "@/components/shell/page-header"
import { buttonVariants } from "@/components/ui/button"
import { ExamTable } from "@/features/exams/exam-table"

export const metadata: Metadata = { title: "Exams" }

export default async function ExamsPage({ searchParams }: PageProps<"/examiner/exams">) {
  const actor = await requirePageRole("examiner")
  const { stage } = await searchParams
  const exams = await listManagedExams(actor)
  return (
    <>
      <PageHeader
        title="Exams"
        description="Every exam you own. Filter by lifecycle stage, sort any column, and open an exam to manage it."
        actions={
          <Link href="/examiner/exams/new" className={buttonVariants()}>
            <FilePlus2 />
            New exam
          </Link>
        }
      />
      <ExamTable
        initialStage={typeof stage === "string" ? stage : "all"}
        rows={exams.map((e) => ({
          id: e.id,
          title: e.title,
          stage: e.stage,
          startsAt: e.startsAt.toISOString(),
          endsAt: e.endsAt.toISOString(),
          durationMin: e.durationMin,
          questionCount: e.questionCount,
          totalMarks: e.totalMarks,
          enrolledCount: e.enrolledCount,
          submittedCount: e.submittedCount,
          activeCount: e.activeCount,
          toGradeCount: e.toGradeCount,
        }))}
      />
    </>
  )
}
