import { requireRole } from "@/server/auth/guards"
import { AppError, errorResponse } from "@/server/errors"
import { saveScratchpad } from "@/server/services/workspace"
import { scratchSchema } from "@/lib/validation/workspace"
export async function PUT(req: Request, ctx: RouteContext<"/api/attempts/[id]/scratchpad">) {
  try {
    const actor = await requireRole("candidate", "examiner")
    const body = await req.json().catch(() => {
      throw new AppError("VALIDATION", "Expected a JSON body.")
    })
    const input = scratchSchema.parse({ attemptId: (await ctx.params).id, text: body?.text })
    await saveScratchpad(actor, input.attemptId, input.text)
    return Response.json({ saved: true })
  } catch (e) {
    return errorResponse(e)
  }
}
