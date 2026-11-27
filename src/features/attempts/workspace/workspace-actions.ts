"use server"
import { requireRole } from "@/server/auth/guards"
import { runAction } from "@/server/errors"
import { savePreferences } from "@/server/services/workspace"
import { preferencesSchema, type Preferences } from "@/lib/validation/workspace"
export async function savePreferencesAction(input: Preferences) {
  return runAction(async () => {
    const actor = await requireRole("candidate", "examiner", "admin")
    return savePreferences(actor, preferencesSchema.parse(input))
  })
}
