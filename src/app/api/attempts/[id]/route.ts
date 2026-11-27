import { requireRole } from "@/server/auth/guards"
import { errorResponse } from "@/server/errors"
import { getAttemptView } from "@/server/services/attempts"

export const dynamic = "force-dynamic"

/** Candidate-safe attempt state with server time (used on resume and resync). */
export async function GET(_req: Request, ctx: RouteContext<"/api/attempts/[id]">) {
  try {
    const { id } = await ctx.params
    const actor = await requireRole("candidate", "examiner")
    return Response.json(await getAttemptView(actor, id), { headers: { "Cache-Control": "no-store" } })
  } catch (e) {
    return errorResponse(e)
  }
}
