import { requireRole } from "@/server/auth/guards"
import { errorResponse } from "@/server/errors"
import { submitAttempt } from "@/server/services/attempts"

export const dynamic = "force-dynamic"

/** Idempotent submit: repeated calls return the same finalized state. */
export async function POST(_req: Request, ctx: RouteContext<"/api/attempts/[id]/submit">) {
  try {
    const { id } = await ctx.params
    const actor = await requireRole("candidate", "examiner")
    return Response.json(await submitAttempt(actor, id), { headers: { "Cache-Control": "no-store" } })
  } catch (e) {
    return errorResponse(e)
  }
}
