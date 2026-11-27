import "server-only"
import { desc, eq } from "drizzle-orm"
import { db, type Db, type Tx } from "@/server/db/client"
import { auditLog, user } from "@/server/db/schema"
import type { SessionUser } from "@/server/auth/guards"
import { AppError } from "@/server/errors"

export async function audit(
  tx: Db | Tx,
  actorId: string | null,
  action: string,
  entityType: string,
  entityId: string,
  meta: Record<string, unknown> = {}
) {
  await tx.insert(auditLog).values({ actorId, action, entityType, entityId, meta })
}

export async function listAudit(actor: SessionUser, limit = 200) {
  if (actor.role !== "admin") throw new AppError("FORBIDDEN", "Only administrators can view the audit log.")
  return db
    .select({
      id: auditLog.id,
      action: auditLog.action,
      entityType: auditLog.entityType,
      entityId: auditLog.entityId,
      meta: auditLog.meta,
      createdAt: auditLog.createdAt,
      actorName: user.name,
      actorEmail: user.email,
    })
    .from(auditLog)
    .leftJoin(user, eq(user.id, auditLog.actorId))
    .orderBy(desc(auditLog.createdAt))
    .limit(limit)
}
