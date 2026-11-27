import "server-only"
import { randomUUID } from "node:crypto"
import { and, asc, eq, ilike, or, sql, type SQL } from "drizzle-orm"
import { hashPassword } from "better-auth/crypto"
import { db, type Db, type Tx } from "@/server/db/client"
import { account, session, user, type Role } from "@/server/db/schema"
import type { SessionUser } from "@/server/auth/guards"
import { AppError, notFound } from "@/server/errors"
import { audit } from "./audit"
import {
  createUserSchema,
  resetPasswordSchema,
  updateUserSchema,
  type CreateUserInput,
  type ResetPasswordInput,
  type UpdateUserInput,
} from "@/lib/validation/users"

function assertAdmin(actor: SessionUser) {
  if (actor.role !== "admin") throw new AppError("FORBIDDEN", "Only administrators can manage users.")
}

/**
 * Creates a user with a credential account (Better Auth model). Used by the
 * admin UI, bulk import and the seed script. Caller is responsible for authz.
 */
export async function insertUserWithPassword(
  tx: Db | Tx,
  input: { name: string; email: string; role: Role; password: string }
) {
  const id = randomUUID()
  const [created] = await tx
    .insert(user)
    .values({ id, name: input.name, email: input.email.toLowerCase(), role: input.role, emailVerified: true })
    .onConflictDoNothing({ target: user.email })
    .returning({ id: user.id })
  if (!created) throw new AppError("CONFLICT", "An account with this email already exists.", { email: "This email is already in use." })
  await tx.insert(account).values({
    id: randomUUID(),
    accountId: id,
    providerId: "credential",
    userId: id,
    password: await hashPassword(input.password),
  })
  return id
}

export async function listUsers(actor: SessionUser, filter: { q?: string; role?: Role } = {}) {
  assertAdmin(actor)
  const where: SQL[] = []
  if (filter.role) where.push(eq(user.role, filter.role))
  if (filter.q) where.push(or(ilike(user.name, `%${filter.q}%`), ilike(user.email, `%${filter.q}%`))!)
  return db
    .select({ id: user.id, name: user.name, email: user.email, role: user.role, active: user.active, createdAt: user.createdAt })
    .from(user)
    .where(where.length ? and(...where) : undefined)
    .orderBy(asc(user.role), asc(user.name))
}

export async function userCounts(actor: SessionUser) {
  assertAdmin(actor)
  const rows = await db
    .select({ role: user.role, active: user.active, n: sql<number>`count(*)::int` })
    .from(user)
    .groupBy(user.role, user.active)
  return rows
}

export async function createUser(actor: SessionUser, raw: CreateUserInput) {
  assertAdmin(actor)
  const input = createUserSchema.parse(raw)
  return db.transaction(async (tx) => {
    const id = await insertUserWithPassword(tx, input)
    await audit(tx, actor.id, "user.created", "user", id, { email: input.email, role: input.role })
    return { id }
  })
}

export async function updateUser(actor: SessionUser, raw: UpdateUserInput) {
  assertAdmin(actor)
  const input = updateUserSchema.parse(raw)
  if (input.id === actor.id && (input.role !== "admin" || !input.active))
    throw new AppError("CONFLICT", "You cannot remove your own administrator access or deactivate yourself.")

  return db.transaction(async (tx) => {
    const [before] = await tx.select().from(user).where(eq(user.id, input.id)).for("update")
    if (!before) throw notFound("User")
    if (before.role === "admin" && (input.role !== "admin" || !input.active)) {
      const [{ n }] = await tx
        .select({ n: sql<number>`count(*)::int` })
        .from(user)
        .where(and(eq(user.role, "admin"), eq(user.active, true)))
      if (n <= 1) throw new AppError("CONFLICT", "At least one active administrator is required.")
    }
    await tx.update(user).set({ name: input.name, role: input.role, active: input.active }).where(eq(user.id, input.id))
    // Deactivation signs the user out everywhere immediately.
    if (!input.active) await tx.delete(session).where(eq(session.userId, input.id))
    await audit(tx, actor.id, "user.updated", "user", input.id, {
      from: { name: before.name, role: before.role, active: before.active },
      to: { name: input.name, role: input.role, active: input.active },
    })
  })
}

export async function resetPassword(actor: SessionUser, raw: ResetPasswordInput) {
  assertAdmin(actor)
  const input = resetPasswordSchema.parse(raw)
  await db.transaction(async (tx) => {
    const updated = await tx
      .update(account)
      .set({ password: await hashPassword(input.password) })
      .where(and(eq(account.userId, input.id), eq(account.providerId, "credential")))
      .returning({ id: account.id })
    if (!updated.length) throw notFound("User")
    await tx.delete(session).where(eq(session.userId, input.id))
    await audit(tx, actor.id, "user.password_reset", "user", input.id)
  })
}
