import type { Metadata } from "next"
import Link from "next/link"
import { Plus } from "lucide-react"
import { requirePageRole } from "@/server/auth/guards"
import { listQuestions, listTopics } from "@/server/services/questions"
import { questionFilterSchema } from "@/lib/validation/questions"
import { PageHeader } from "@/components/shell/page-header"
import { buttonVariants } from "@/components/ui/button"
import { QuestionBank } from "@/features/questions/question-bank"

export const metadata: Metadata = { title: "Question bank" }

export default async function BankPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const actor = await requirePageRole("examiner")
  const raw = await searchParams
  const parsed = questionFilterSchema.safeParse({
    q: raw.q || undefined,
    type: raw.type || undefined,
    difficulty: raw.difficulty || undefined,
    topic: raw.topic || undefined,
  })
  const filter = parsed.success ? parsed.data : {}
  const [rows, topics] = await Promise.all([listQuestions(actor, filter), listTopics(actor)])

  return (
    <>
      <PageHeader
        title="Question bank"
        description="Reusable questions organised by topic and difficulty. Questions in a published exam are locked so every candidate sees the same version."
        actions={
          <Link href="/examiner/bank/new" className={buttonVariants()}>
            <Plus />
            New question
          </Link>
        }
      />
      <QuestionBank rows={rows.map((r) => ({ ...r, updatedAt: r.updatedAt.toISOString() }))} topics={topics} filter={filter} />
    </>
  )
}
