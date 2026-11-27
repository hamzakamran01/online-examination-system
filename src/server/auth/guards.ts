import "server-only"
import { cache } from "react"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { eq } from "drizzle-orm"
import { auth } from "./auth"
import { db } from "@/server/db/client"
import { user as userTable, type Role } from "@/server/db/schema"
import { AppError } from "@/server/errors"

export type SessionUser = { id: string; name: string; email: string; role: Role }

/**
 * Resolve the current user from the DB session. Role and active flag are
 * re-read from the user table on every request, so a role change or
 * deactivation takes effect immediately (no stale cookie claims).
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const s = await auth.api.getSession({ headers: await headers() })
  if (!s) return null
  const [u] = await db
    .select({ id: userTable.id, name: userTable.name, email: userTable.email, role: userTable.role, active: userTable.active })
    .from(userTable)
    .where(eq(userTable.id, s.user.id))
    .limit(1)
  if (!u || !u.active) return null
  return { id: u.id, name: u.name, email: u.email, role: u.role }
})

export const homeFor = (role: Role) =>
  role === "admin" ? "/admin/overview" : role === "examiner" ? "/examiner" : "/candidate"

/** For pages: redirect to login or to the user's own home when the role does not match. */
export async function requirePageRole(...roles: Role[]): Promise<SessionUser> {
  const u = await getCurrentUser()
  if (!u) redirect("/login")
  if (roles.length && !roles.includes(u.role)) redirect(homeFor(u.role))
  return u
}

/** For actions and route handlers: throw typed errors that map to 401/403. */
export async function requireRole(...roles: Role[]): Promise<SessionUser> {
  const u = await getCurrentUser()
  if (!u) throw new AppError("UNAUTHENTICATED", "Your session has ended. Please sign in again.")
  if (roles.length && !roles.includes(u.role)) throw new AppError("FORBIDDEN", "You do not have permission to do this.")
  return u
}
