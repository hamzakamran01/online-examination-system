import type { Metadata } from "next"
import { requirePageRole } from "@/server/auth/guards"
import { getManagedExam } from "@/server/services/exams"
import { MonitorBoard } from "@/features/monitoring/monitor-board"

export const metadata: Metadata = { title: "Live monitor" }

export default async function MonitorPage({ params }: PageProps<"/examiner/exams/[examId]/monitor">) {
  const actor = await requirePageRole("examiner")
  const { examId } = await params
  await getManagedExam(actor, examId)
  return <MonitorBoard examId={examId} />
}
