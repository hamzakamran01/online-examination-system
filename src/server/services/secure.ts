import "server-only"
import { createHash, randomInt, timingSafeEqual } from "node:crypto"
import { eq } from "drizzle-orm"
import { db } from "@/server/db/client"
import { answers, attemptEvents, attempts } from "@/server/db/schema"
import type { SessionUser } from "@/server/auth/guards"
import { AppError, notFound } from "@/server/errors"
import { MAX_UNLOCK_FAILURES, UNLOCK_CODE_TTL_MS, isSecure, itemDeadline } from "@/lib/domain/secure"
import { advanceSchema, lockSchema, releaseSchema, unlockWithCodeSchema, type AdvanceInput } from "@/lib/validation/secure"
import { getManagedExam } from "./exams"
import { finalizeLocked, lockOwnAttempt, syncSecure } from "./attempts"
import { audit } from "./audit"

/*
 * Secure sequential delivery: the server owns the cursor, the per-question timers and the lock.
 * The browser can only ask to move forward, report that it left full screen, or present a code.
 */

const hashCode = (attemptId: string, code: string) => createHash("sha256").update(`${attemptId}:${code}`).digest("hex")

/**
 * Candidate submits the open question and moves to the next one. Idempotent: the request names
 * the question it is closing, so a retry after the server already moved on is a no-op.
 * The final answer travels in the same request, so "submit question" never races the autosave.
 */
export async function advanceQuestion(actor: SessionUser, attemptId: string, raw: AdvanceInput) {
  const input = advanceSchema.parse(raw)
  const now = new Date()
  return db.transaction(async (tx) => {
    const row = await lockOwnAttempt(tx, actor, attemptId)
    if (!isSecure(row.paper)) throw new AppError("CONFLICT", "This exam lets you move between questions freely.")
    const a = await syncSecure(tx, row, now)
    if (a.status !== "in_progress") return { status: a.status, cursor: a.cursor, finished: true, duplicate: false }
    if (a.lockedAt) throw new AppError("LOCKED", "Your exam is paused. Ask your examiner to release it.")
    if (input.index !== a.cursor) {
      // Already closed (retry, or its timer ran out first): report where the paper is now.
      return { status: a.status, cursor: a.cursor, finished: false, duplicate: true }
    }
    const item = a.paper.items[a.cursor]
    if (input.response !== undefined) {
      if (input.response !== null && (input.response.kind === "text") !== (item.type === "written"))
        throw new AppError("VALIDATION", "That answer does not fit this question.")
      if (input.response?.kind === "choice") {
        const allowed = new Set(item.options.map((o) => o.id))
        if (input.response.selected.some((id) => !allowed.has(id))) throw new AppError("VALIDATION", "An option does not belong to this question.")
        if (item.type === "single" && input.response.selected.length > 1) throw new AppError("VALIDATION", "Select only one option.")
      }
      await tx
        .insert(answers)
        .values({ attemptId: a.id, itemId: item.itemId, response: input.response, flagged: false, clientSeq: input.seq, savedAt: now })
        .onConflictDoUpdate({
          target: [answers.attemptId, answers.itemId],
          set: { response: input.response, clientSeq: input.seq, savedAt: now },
        })
    }
    const next = a.cursor + 1
    await tx.update(attempts).set({ cursor: next, itemStartedAt: now, lastSeenAt: now }).where(eq(attempts.id, a.id))
    await tx.insert(attemptEvents).values({ attemptId: a.id, type: "question_closed", source: "server", detail: { index: a.cursor, reason: "submitted" } })
    if (next >= a.paper.items.length) {
      await finalizeLocked(tx, { ...a, cursor: next }, "candidate", now)
      if (!a.isSandbox) await audit(tx, actor.id, "attempt.submitted", "attempt", a.id, { reason: "candidate", mode: "secure" })
      return { status: "submitted" as const, cursor: next, finished: true, duplicate: false }
    }
    return {
      status: a.status,
      cursor: next,
      finished: false,
      duplicate: false,
      itemDeadlineAt: itemDeadline(a.paper, next, now, a.deadlineAt).toISOString(),
    }
  })
}

/**
 * The page reports that the candidate left full screen, the tab or the window. The attempt
 * locks immediately; timers keep running on the server. Sandbox previews never lock.
 */
export async function lockAttempt(actor: SessionUser, attemptId: string, raw: { reason: string }) {
  const { reason } = lockSchema.parse(raw)
  const now = new Date()
  return db.transaction(async (tx) => {
    const a = await syncSecure(tx, await lockOwnAttempt(tx, actor, attemptId), now)
    if (!isSecure(a.paper) || a.isSandbox || a.status !== "in_progress") return { locked: false }
    if (a.lockedAt) return { locked: true }
    await tx.update(attempts).set({ lockedAt: now, lockReason: reason }).where(eq(attempts.id, a.id))
    await tx.insert(attemptEvents).values({ attemptId: a.id, type: "secure_locked", source: "server", detail: { reason } })
    return { locked: true }
  })
}

/** Examiner (exam owner) releases a locked attempt from the live monitor. Audited with a reason. */
export async function releaseAttempt(actor: SessionUser, raw: { attemptId: string; note: string }) {
  if (actor.role !== "examiner") throw new AppError("FORBIDDEN", "Only the exam owner can release a paused attempt.")
  const input = releaseSchema.parse(raw)
  return db.transaction(async (tx) => {
    const [a] = await tx.select().from(attempts).where(eq(attempts.id, input.attemptId)).for("update")
    if (!a || a.isSandbox) throw notFound("Attempt")
    await getManagedExam(actor, a.examId, { write: true })
    if (a.status !== "in_progress") throw new AppError("CONFLICT", "This attempt is already submitted.")
    if (!a.lockedAt) return { released: false, alreadyOpen: true }
    const pausedSec = Math.round((Date.now() - a.lockedAt.getTime()) / 1000)
    await tx
      .update(attempts)
      .set({ lockedAt: null, lockReason: null, unlockCodeHash: null, unlockCodeExpiresAt: null, unlockFailures: 0 })
      .where(eq(attempts.id, a.id))
    await tx.insert(attemptEvents).values({ attemptId: a.id, type: "secure_released", source: "server", detail: { by: "examiner", pausedSec } })
    await audit(tx, actor.id, "attempt.secure_released", "attempt", a.id, { method: "monitor", note: input.note, lockReason: a.lockReason, pausedSec })
    return { released: true, alreadyOpen: false }
  })
}

/**
 * Examiner issues a one-time 6 digit code for one locked attempt (exam hall use: read it out).
 * Only a hash is stored. Valid for 5 minutes, one use, 5 wrong tries then a new code is needed.
 */
export async function issueUnlockCode(actor: SessionUser, raw: { attemptId: string; note: string }) {
  if (actor.role !== "examiner") throw new AppError("FORBIDDEN", "Only the exam owner can issue unlock codes.")
  const input = releaseSchema.parse(raw)
  return db.transaction(async (tx) => {
    const [a] = await tx.select().from(attempts).where(eq(attempts.id, input.attemptId)).for("update")
    if (!a || a.isSandbox) throw notFound("Attempt")
    await getManagedExam(actor, a.examId, { write: true })
    if (a.status !== "in_progress") throw new AppError("CONFLICT", "This attempt is already submitted.")
    if (!a.lockedAt) throw new AppError("CONFLICT", "This attempt is not paused, so no code is needed.")
    const code = String(randomInt(0, 1_000_000)).padStart(6, "0")
    const expiresAt = new Date(Date.now() + UNLOCK_CODE_TTL_MS)
    await tx
      .update(attempts)
      .set({ unlockCodeHash: hashCode(a.id, code), unlockCodeExpiresAt: expiresAt, unlockFailures: 0 })
      .where(eq(attempts.id, a.id))
    await audit(tx, actor.id, "attempt.unlock_code_issued", "attempt", a.id, { note: input.note, expiresAt: expiresAt.toISOString() })
    // The plain code is returned once, to the examiner only, and never stored.
    return { code, expiresAt: expiresAt.toISOString() }
  })
}

/** Candidate enters the examiner's code on the locked screen. */
export async function unlockWithCode(actor: SessionUser, attemptId: string, raw: { code: string }) {
  const { code } = unlockWithCodeSchema.parse(raw)
  const now = new Date()
  const result = await db.transaction(async (tx) => {
    const a = await lockOwnAttempt(tx, actor, attemptId)
    if (a.status !== "in_progress") throw new AppError("CONFLICT", "This attempt is already submitted.")
    if (!a.lockedAt) return { ok: true as const }
    if (!a.unlockCodeHash || !a.unlockCodeExpiresAt || a.unlockCodeExpiresAt <= now)
      return { ok: false as const, message: "No valid code for this attempt. Ask your examiner for a new one." }
    if (a.unlockFailures >= MAX_UNLOCK_FAILURES)
      return { ok: false as const, message: "Too many wrong codes. Ask your examiner for a new one." }
    const expected = Buffer.from(a.unlockCodeHash, "hex")
    const given = Buffer.from(hashCode(a.id, code), "hex")
    if (!timingSafeEqual(expected, given)) {
      await tx.update(attempts).set({ unlockFailures: a.unlockFailures + 1 }).where(eq(attempts.id, a.id))
      const left = MAX_UNLOCK_FAILURES - a.unlockFailures - 1
      return { ok: false as const, message: left > 0 ? `That code is not right. ${left} tr${left === 1 ? "y" : "ies"} left.` : "Too many wrong codes. Ask your examiner for a new one." }
    }
    const pausedSec = Math.round((now.getTime() - a.lockedAt.getTime()) / 1000)
    await tx
      .update(attempts)
      .set({ lockedAt: null, lockReason: null, unlockCodeHash: null, unlockCodeExpiresAt: null, unlockFailures: 0 })
      .where(eq(attempts.id, a.id))
    await tx.insert(attemptEvents).values({ attemptId: a.id, type: "secure_released", source: "server", detail: { by: "code", pausedSec } })
    await audit(tx, actor.id, "attempt.secure_released", "attempt", a.id, { method: "code", pausedSec })
    return { ok: true as const }
  })
  if (!result.ok) throw new AppError("VALIDATION", result.message, { code: result.message })
  return { released: true }
}

