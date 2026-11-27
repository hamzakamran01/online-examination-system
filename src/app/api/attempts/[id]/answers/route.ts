import { requireRole } from "@/server/auth/guards"
import { AppError, errorResponse } from "@/server/errors"
import { saveAnswers } from "@/server/services/attempts"

export const dynamic = "force-dynamic"

/** Batched autosave. Idempotent and order-safe via per-item client sequence numbers. */
export async function PUT(req: Request, ctx: RouteContext<"/api/attempts/[id]/answers">) {
  try {
    const { id } = await ctx.params
    const actor = await requireRole("candidate", "examiner")
    const body = await req.json().catch(() => {
      throw new AppError("VALIDATION", "Request body must be JSON.")
    })
    return Response.json(await saveAnswers(actor, id, body), { headers: { "Cache-Control": "no-store" } })
  } catch (e) {
    return errorResponse(e)
  }
}
