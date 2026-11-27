import { requireRole } from "@/server/auth/guards"
import { AppError, errorResponse } from "@/server/errors"
import { heartbeat } from "@/server/services/attempts"

export const dynamic = "force-dynamic"

/** Workspace heartbeat: presence, queued signals, server time, deadline, announcements, extensions. */
export async function POST(req: Request, ctx: RouteContext<"/api/attempts/[id]/heartbeat">) {
  try {
    const { id } = await ctx.params
    const actor = await requireRole("candidate", "examiner")
    const body = await req.json().catch(() => {
      throw new AppError("VALIDATION", "Request body must be JSON.")
    })
    return Response.json(await heartbeat(actor, id, body), { headers: { "Cache-Control": "no-store" } })
  } catch (e) {
    return errorResponse(e)
  }
}
