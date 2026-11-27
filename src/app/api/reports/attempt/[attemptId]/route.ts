import { z } from "zod"
import { requireRole } from "@/server/auth/guards"
import { errorResponse } from "@/server/errors"
import { getResultReport } from "@/server/services/reports"
import { attachment, resultPdf } from "@/features/reports/pdf"
export const runtime = "nodejs"
export async function GET(_: Request, ctx: RouteContext<"/api/reports/attempt/[attemptId]">) {
  try {
    const actor = await requireRole("candidate", "examiner", "admin")
    const { attemptId } = z.object({ attemptId: z.uuid() }).parse(await ctx.params)
    return attachment(await resultPdf(await getResultReport(actor, attemptId)), "result-" + attemptId)
  } catch (e) {
    return errorResponse(e)
  }
}
