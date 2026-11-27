import { z } from "zod"
import { requireRole } from "@/server/auth/guards"
import { errorResponse } from "@/server/errors"
import { importSchema } from "@/lib/validation/imports"
import { processImport } from "@/server/services/imports"
export const maxDuration = 60
export async function POST(req: Request) {
  try {
    const actor = await requireRole("examiner")
    const { commit, ...input } = importSchema.extend({ commit: z.boolean() }).parse(await req.json())
    return Response.json(await processImport(actor, input, commit), { headers: { "Cache-Control": "no-store" } })
  } catch (e) {
    return errorResponse(e)
  }
}
