import {requirePageRole} from "@/server/auth/guards"
import {getExamAnalytics} from "@/server/services/analytics"
import {Insights} from "@/features/analytics/insights"
import {Suspense} from "react"
async function Analytics({examId}:{examId:string}) {
  const actor=await requirePageRole("examiner","admin")
  return <Insights data={await getExamAnalytics(actor,examId)}/>
}
export default async function Page({params}:PageProps<"/examiner/exams/[examId]/analytics">) {
  const {examId}=await params
  return <Suspense fallback={<p role="status">Loading analytics...</p>}><Analytics examId={examId}/></Suspense>
}
