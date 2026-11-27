import "server-only"
import { and, count, eq, gt } from "drizzle-orm"
import type { Tx } from "@/server/db/client"
import { attemptEvents, attempts } from "@/server/db/schema"
import {
  CLIENT_SIGNAL_CAP,
  DEVICE_CHANGE_DEDUPE_MS,
  MIN_TAB_AWAY_MS,
  measureGapSec,
} from "@/lib/domain/monitoring"
import type { ClientSignal } from "@/lib/validation/monitoring"

type Presence = Pick<typeof attempts.$inferSelect, "id" | "lastSeenAt" | "lastClientId">

/**
 * Records that the server heard from an in-progress attempt (I-5.3).
 * Call inside the transaction that holds the attempt row lock.
 *
 * - A silence longer than the gap threshold is stored as a server-measured
 *   `connection_gap`: the evidence comes from server timestamps, not from the candidate.
 * - A different client id means the attempt continued on another browser or device.
 */
export async function touchAttempt(tx: Tx, a: Presence, clientId: string, now: Date) {
  const gapSec = measureGapSec(a.lastSeenAt, now)
  if (gapSec !== null && a.lastSeenAt)
    await tx.insert(attemptEvents).values({
      attemptId: a.id,
      type: "connection_gap",
      source: "server",
      detail: { gapSec, from: a.lastSeenAt.toISOString(), to: now.toISOString() },
    })

  if (a.lastClientId && a.lastClientId !== clientId) {
    // Two devices taking turns would log on every request: collapse repeats.
    const [recent] = await tx
      .select({ n: count() })
      .from(attemptEvents)
      .where(
        and(
          eq(attemptEvents.attemptId, a.id),
          eq(attemptEvents.type, "device_change"),
          gt(attemptEvents.serverTs, new Date(now.getTime() - DEVICE_CHANGE_DEDUPE_MS))
        )
      )
    if (!recent?.n)
      await tx.insert(attemptEvents).values({
        attemptId: a.id,
        type: "device_change",
        source: "server",
        detail: { note: "Continued from a different browser or device" },
      })
  }

  await tx.update(attempts).set({ lastSeenAt: now, lastClientId: clientId }).where(eq(attempts.id, a.id))
}

/**
 * Stores client observed signals (C-3.6.3). Short tab switches are ignored,
 * and an attempt can store at most CLIENT_SIGNAL_CAP client signals so a
 * misbehaving client cannot flood the table. Returns how many were stored.
 */
export async function recordClientSignals(tx: Tx, attemptId: string, signals: ClientSignal[], now: Date) {
  const meaningful = signals.filter((s) => s.type !== "tab_hidden" || (s.durationMs ?? 0) >= MIN_TAB_AWAY_MS)
  if (!meaningful.length) return 0
  const [stored] = await tx
    .select({ n: count() })
    .from(attemptEvents)
    .where(and(eq(attemptEvents.attemptId, attemptId), eq(attemptEvents.source, "client")))
  const room = Math.max(0, CLIENT_SIGNAL_CAP - (stored?.n ?? 0))
  const accepted = meaningful.slice(0, room)
  if (!accepted.length) return 0
  await tx.insert(attemptEvents).values(
    accepted.map((s) => ({
      attemptId,
      type: s.type,
      source: "client" as const,
      detail: s.durationMs !== undefined ? { durationMs: s.durationMs } : {},
      // Device time is kept for context only; ordering and evidence use server_ts.
      clientTs: s.at ? new Date(s.at) : null,
      serverTs: now,
    }))
  )
  return accepted.length
}
