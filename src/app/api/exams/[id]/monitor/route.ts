import { requireRole } from "@/server/auth/guards"
import { errorResponse } from "@/server/errors"
import { getExamMonitor } from "@/server/services/monitoring"

export const dynamic = "force-dynamic"

/** Live monitor, polled by the examiner board (C-3.6.1). Owner examiner, or admin read-only. */
export async function GET(_req: Request, ctx: RouteContext<"/api/exams/[id]/monitor">) {
  try {
    const { id } = await ctx.params
    const actor = await requireRole("examiner", "admin")
    return Response.json(await getExamMonitor(actor, id), { headers: { "Cache-Control": "no-store" } })
  } catch (e) {
    return errorResponse(e)
  }
}
