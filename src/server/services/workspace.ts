import "server-only"
import { and, eq, sql } from "drizzle-orm"
import { db } from "@/server/db/client"
import { attempts, userPreferences } from "@/server/db/schema"
import type { SessionUser } from "@/server/auth/guards"
import { AppError, notFound } from "@/server/errors"
import { preferencesSchema, defaults, scratchSchema, type Preferences } from "@/lib/validation/workspace"
function requireUser(actor: SessionUser) {
  if (!["admin", "examiner", "candidate"].includes(actor.role))
    throw new AppError("FORBIDDEN", "Account access required.")
}
export async function getPreferences(actor: SessionUser) {
  requireUser(actor)
  const [row] = await db.select().from(userPreferences).where(eq(userPreferences.userId, actor.id))
  return preferencesSchema.parse(row ?? defaults)
}
export async function savePreferences(actor: SessionUser, input: Preferences) {
  requireUser(actor)
  const prefs = preferencesSchema.parse(input)
  await db
    .insert(userPreferences)
    .values({ userId: actor.id, ...prefs })
    .onConflictDoUpdate({ target: userPreferences.userId, set: { ...prefs, updatedAt: new Date() } })
  return prefs
}
export async function saveScratchpad(actor: SessionUser, attemptId: string, text: string) {
  if (actor.role !== "candidate" && actor.role !== "examiner") throw notFound("Attempt")
  const input = scratchSchema.parse({ attemptId, text })
  await db.transaction(async (tx) => {
    const owned = and(
      eq(attempts.id, input.attemptId),
      eq(attempts.candidateId, actor.id),
      eq(attempts.isSandbox, actor.role === "examiner"),
    )
    const [row] = await tx.select({ status: attempts.status }).from(attempts).where(owned).for("update")
    if (!row) throw notFound("Attempt")
    if (row.status !== "in_progress") throw new AppError("CONFLICT", "This attempt is closed.")
    const saved = await tx
      .update(attempts)
      .set({ scratchpad: input.text })
      .where(and(owned, sql`${attempts.deadlineAt} > clock_timestamp()`))
      .returning({ id: attempts.id })
    if (!saved.length) throw new AppError("DEADLINE_PASSED", "The attempt deadline has passed.")
  })
}
