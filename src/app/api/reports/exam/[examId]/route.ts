import { z } from "zod"
import { requireRole } from "@/server/auth/guards"
import { errorResponse } from "@/server/errors"
import { getExamAnalytics } from "@/server/services/analytics"
import { attachment, examPdf } from "@/features/reports/pdf"
export const runtime = "nodejs"
export async function GET(_: Request, ctx: RouteContext<"/api/reports/exam/[examId]">) {
  try {
    const actor = await requireRole("examiner", "admin")
    const { examId } = z.object({ examId: z.uuid() }).parse(await ctx.params)
    return attachment(await examPdf(await getExamAnalytics(actor, examId)), "exam-" + examId)
  } catch (e) {
    return errorResponse(e)
  }
}
