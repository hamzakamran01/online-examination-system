import type { Metadata } from "next"
import { requirePageRole } from "@/server/auth/guards"
import { getPreferences } from "@/server/services/workspace"
import { PageHeader } from "@/components/shell/page-header"
import { PreferencesStudio } from "@/features/attempts/workspace/preferences-studio"

export const metadata: Metadata = { title: "Exam preferences" }

export default async function PreferencesPage() {
  const actor = await requirePageRole("candidate")
  const prefs = await getPreferences(actor)
  return (
    <>
      <PageHeader
        title="Exam preferences"
        description="Set how the exam screen looks before you sit an exam. Your choices are saved to your account and apply in every exam; you can still change them during an exam."
      />
      <PreferencesStudio initial={prefs} />
    </>
  )
}
