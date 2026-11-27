import { requirePageRole } from "@/server/auth/guards"
import { listManagedExams } from "@/server/services/exams"
import { PageHeader } from "@/components/shell/page-header"
import { ImportManager } from "@/features/imports/import-manager"
export default async function Page() {
  const exams = await listManagedExams(await requirePageRole("examiner"))
  return (
    <>
      <PageHeader
        title="Bulk import"
        description="Preview candidate accounts or question bank items before importing."
      />
      <ImportManager exams={exams.filter((e) => e.effective !== "completed").map(({ id, title }) => ({ id, title }))} />
    </>
  )
}
