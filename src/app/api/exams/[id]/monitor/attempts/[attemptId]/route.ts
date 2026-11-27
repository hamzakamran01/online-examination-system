import { requireRole } from "@/server/auth/guards"
import { errorResponse } from "@/server/errors"
import { getAttemptTimeline } from "@/server/services/monitoring"

export const dynamic = "force-dynamic"

/** Signal timeline and granted extensions for one attempt (C-3.6.3). */
export async function GET(_req: Request, ctx: RouteContext<"/api/exams/[id]/monitor/attempts/[attemptId]">) {
  try {
    const { id, attemptId } = await ctx.params
    const actor = await requireRole("examiner", "admin")
    return Response.json(await getAttemptTimeline(actor, id, attemptId), { headers: { "Cache-Control": "no-store" } })
  } catch (e) {
    return errorResponse(e)
  }
}
