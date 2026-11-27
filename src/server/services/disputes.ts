import "server-only"
import { and, asc, count, desc, eq, ne, sql } from "drizzle-orm"
import { db } from "@/server/db/client"
import { answers, attempts, auditLog, disputes, exams, itemVoids, user } from "@/server/db/schema"
import type { SessionUser } from "@/server/auth/guards"
import { AppError, notFound } from "@/server/errors"
import type { AnswerResponse, PaperItem } from "@/lib/domain/paper"
import { itemOutcome, type VoidRule } from "@/lib/domain/scoring"
import {
  MAX_DISPUTES_PER_ATTEMPT,
  disputeWindow,
  isHotspot,
  type DisputeStatus,
  type DisputeType,
} from "@/lib/domain/disputes"
import {
  raiseDisputeSchema,
  resolveDisputeSchema,
  withdrawDisputeSchema,
  type RaiseDisputeInput,
  type ResolveDisputeInput,
} from "@/lib/validation/disputes"
import { getManagedExam } from "./exams"
import { loadVoids, recalcAttempt } from "./attempts"
import { supersedeChangedReports } from "./reports"
import { getAttemptEvidence } from "./monitoring"
import { audit } from "./audit"

const answerEntity = (attemptId: string, itemId: string) => `${attemptId}:${itemId}`

/* ----------------------------------------------------------------------------
 * Candidate side (I-5.4)
 * ------------------------------------------------------------------------- */
export type CandidateDispute = {
  id: string
  itemId: string
  type: DisputeType
  statement: string
  status: DisputeStatus
  marksBefore: number | null
  marksAfter: number | null
  resolutionNote: string | null
  createdAt: string
  resolvedAt: string | null
}

/** Disputes of the candidate's own attempt, plus whether new ones can be raised. */
export async function getCandidateDisputes(actor: SessionUser, attemptId: string) {
  if (actor.role !== "candidate") throw notFound("Result")
  const [a] = await db
    .select({ id: attempts.id, publishedAt: exams.resultsPublishedAt })
    .from(attempts)
    .innerJoin(exams, eq(exams.id, attempts.examId))
    .where(and(eq(attempts.id, attemptId), eq(attempts.candidateId, actor.id), eq(attempts.isSandbox, false), ne(attempts.status, "in_progress")))
  if (!a) throw notFound("Result")
  const rows = await db
    .select({
      id: disputes.id,
      itemId: disputes.itemId,
      type: disputes.type,
      statement: disputes.statement,
      status: disputes.status,
      marksBefore: disputes.marksBefore,
      marksAfter: disputes.marksAfter,
      resolutionNote: disputes.resolutionNote,
      createdAt: disputes.createdAt,
      resolvedAt: disputes.resolvedAt,
    })
    .from(disputes)
    .where(eq(disputes.attemptId, attemptId))
    .orderBy(asc(disputes.createdAt))
  const window = disputeWindow(a.publishedAt)
  const active = rows.filter((r) => r.status !== "withdrawn").length
  return {
    window: { open: window.open, closesAt: window.closesAt?.toISOString() ?? null },
    remaining: Math.max(0, MAX_DISPUTES_PER_ATTEMPT - active),
    max: MAX_DISPUTES_PER_ATTEMPT,
    disputes: rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString(), resolvedAt: r.resolvedAt?.toISOString() ?? null })) as CandidateDispute[],
  }
}

/**
 * Raise a dispute on one question (I-5.4). Own, published, non-sandbox attempt only,
 * inside the window, one per question, capped per attempt. The attempt row is locked so
 * two tabs cannot race past the cap. A repeat of the same request returns the existing dispute.
 */
export async function raiseDispute(actor: SessionUser, raw: RaiseDisputeInput) {
  if (actor.role !== "candidate") throw new AppError("FORBIDDEN", "Only candidates can raise disputes on their own results.")
  const input = raiseDisputeSchema.parse(raw)
  return db.transaction(async (tx) => {
    const [a] = await tx
      .select()
      .from(attempts)
      .where(and(eq(attempts.id, input.attemptId), eq(attempts.candidateId, actor.id), eq(attempts.isSandbox, false)))
      .for("update")
    if (!a || a.status === "in_progress") throw notFound("Result")
    const [exam] = await tx.select({ id: exams.id, publishedAt: exams.resultsPublishedAt }).from(exams).where(eq(exams.id, a.examId))
    if (!exam?.publishedAt) throw notFound("Result")
    const window = disputeWindow(exam.publishedAt)
    if (!window.open) throw new AppError("CONFLICT", "The window for disputes on this result has closed.")
    const item = a.paper.items.find((i) => i.itemId === input.itemId)
    if (!item) throw notFound("Question")

    const [existing] = await tx
      .select({ id: disputes.id, status: disputes.status })
      .from(disputes)
      .where(and(eq(disputes.attemptId, a.id), eq(disputes.itemId, item.itemId)))
    if (existing) {
      if (existing.status === "withdrawn") throw new AppError("CONFLICT", "You withdrew a dispute on this question, so it cannot be raised again.")
      return { id: existing.id, duplicate: true }
    }
    const voids = await loadVoids(tx, a.examId)
    if (voids.has(item.itemId)) throw new AppError("CONFLICT", "This question has already been voided for every candidate.")
    const [{ n }] = await tx
      .select({ n: count() })
      .from(disputes)
      .where(and(eq(disputes.attemptId, a.id), ne(disputes.status, "withdrawn")))
    if (n >= MAX_DISPUTES_PER_ATTEMPT)
      throw new AppError("CONFLICT", `You can raise at most ${MAX_DISPUTES_PER_ATTEMPT} disputes on one result.`)

    const [row] = await tx.select({ autoScore: answers.autoScore, manualScore: answers.manualScore }).from(answers).where(and(eq(answers.attemptId, a.id), eq(answers.itemId, item.itemId)))
    const current = itemOutcome(item, row, null).score
    const [d] = await tx
      .insert(disputes)
      .values({
        examId: a.examId,
        attemptId: a.id,
        itemId: item.itemId,
        candidateId: actor.id,
        type: input.type,
        statement: input.statement,
        marksBefore: current,
      })
      .returning({ id: disputes.id })
    await audit(tx, actor.id, "dispute.raised", "dispute", d.id, { examId: a.examId, attemptId: a.id, itemId: item.itemId, type: input.type })
    return { id: d.id, duplicate: false }
  })
}

/** Candidate withdraws an open dispute. Final: it cannot be raised again on that question. */
export async function withdrawDispute(actor: SessionUser, raw: { disputeId: string }) {
  if (actor.role !== "candidate") throw new AppError("FORBIDDEN", "Only the candidate who raised a dispute can withdraw it.")
  const { disputeId } = withdrawDisputeSchema.parse(raw)
  return db.transaction(async (tx) => {
    const [d] = await tx.select().from(disputes).where(and(eq(disputes.id, disputeId), eq(disputes.candidateId, actor.id))).for("update")
    if (!d) throw notFound("Dispute")
    if (d.status === "withdrawn") return { status: d.status }
    if (d.status !== "open") throw new AppError("CONFLICT", "This dispute has already been decided.")
    await tx.update(disputes).set({ status: "withdrawn", resolvedAt: new Date() }).where(eq(disputes.id, d.id))
    await audit(tx, actor.id, "dispute.withdrawn", "dispute", d.id, { examId: d.examId, attemptId: d.attemptId })
    return { status: "withdrawn" as const }
  })
}

/* ----------------------------------------------------------------------------
 * Examiner side (I-5.4): queue, hotspots, evidence pack, resolution
 * ------------------------------------------------------------------------- */
export async function listExamDisputes(actor: SessionUser, examId: string) {
  const exam = await getManagedExam(actor, examId)
  const rows = await db
    .select({
      id: disputes.id,
      attemptId: disputes.attemptId,
      itemId: disputes.itemId,
      type: disputes.type,
      status: disputes.status,
      statement: disputes.statement,
      createdAt: disputes.createdAt,
      resolvedAt: disputes.resolvedAt,
      candidate: user.name,
      email: user.email,
      paper: attempts.paper,
    })
    .from(disputes)
    .innerJoin(user, eq(user.id, disputes.candidateId))
    .innerJoin(attempts, eq(attempts.id, disputes.attemptId))
    .where(eq(disputes.examId, exam.id))
    .orderBy(sql`case when ${disputes.status} = 'open' then 0 else 1 end`, asc(disputes.createdAt))

  const [{ finalized }] = await db
    .select({ finalized: sql<number>`count(*)::int` })
    .from(attempts)
    .where(and(eq(attempts.examId, exam.id), eq(attempts.isSandbox, false), ne(attempts.status, "in_progress")))
  const voids = await loadVoids(db, exam.id)

  const list = rows.map(({ paper, ...r }) => {
    const index = paper.items.findIndex((i) => i.itemId === r.itemId)
    const item = paper.items[index]
    return {
      ...r,
      createdAt: r.createdAt.toISOString(),
      resolvedAt: r.resolvedAt?.toISOString() ?? null,
      position: index + 1,
      stem: item?.stem ?? "",
      itemType: item?.type ?? "written",
    }
  })

  // Questions attracting disputes (I-5.4): grouped by question, not by paper position,
  // because shuffled papers show the same question at different numbers.
  const byItem = new Map<string, { itemId: string; stem: string; total: number; open: number; types: Record<string, number> }>()
  for (const d of list) {
    if (d.status === "withdrawn") continue
    const h = byItem.get(d.itemId) ?? { itemId: d.itemId, stem: d.stem, total: 0, open: 0, types: {} }
    h.total++
    if (d.status === "open") h.open++
    h.types[d.type] = (h.types[d.type] ?? 0) + 1
    byItem.set(d.itemId, h)
  }
  const questions = [...byItem.values()]
    .map((h) => ({ ...h, rate: finalized ? h.total / finalized : 0, hotspot: isHotspot(h.total, finalized), voided: voids.get(h.itemId) ?? null }))
    .sort((a, b) => b.total - a.total)

  return {
    exam: { id: exam.id, title: exam.title, resultsPublishedAt: exam.resultsPublishedAt?.toISOString() ?? null },
    window: disputeWindow(exam.resultsPublishedAt),
    canAct: actor.role === "examiner" && exam.ownerId === actor.id,
    finalized,
    summary: {
      open: list.filter((d) => d.status === "open").length,
      resolved: list.filter((d) => d.status !== "open" && d.status !== "withdrawn").length,
      upheld: list.filter((d) => d.status === "regraded" || d.status === "voided").length,
    },
    disputes: list,
    questions,
  }
}

/** Open dispute counts per exam owned by the examiner, for navigation badges and the desk. */
export async function countOpenDisputes(actor: SessionUser, examId: string) {
  await getManagedExam(actor, examId)
  const [{ n }] = await db.select({ n: count() }).from(disputes).where(and(eq(disputes.examId, examId), eq(disputes.status, "open")))
  return n
}

export type EvidencePack = Awaited<ReturnType<typeof getDisputeEvidence>>

/**
 * Evidence pack (I-5.4): the question exactly as this candidate saw it (frozen paper,
 * their option order), their answer, the marking guide, marks and grading history,
 * server-measured outages and review signals, and how the whole cohort did on the same
 * question. Owner examiner or admin (read only).
 */
export async function getDisputeEvidence(actor: SessionUser, examId: string, disputeId: string) {
  const exam = await getManagedExam(actor, examId)
  const [d] = await db
    .select({ dispute: disputes, candidate: user.name, email: user.email })
    .from(disputes)
    .innerJoin(user, eq(user.id, disputes.candidateId))
    .where(and(eq(disputes.id, disputeId), eq(disputes.examId, exam.id)))
  if (!d) throw notFound("Dispute")
  const [a] = await db.select().from(attempts).where(eq(attempts.id, d.dispute.attemptId))
  if (!a) throw notFound("Dispute")
  const index = a.paper.items.findIndex((i) => i.itemId === d.dispute.itemId)
  const item = a.paper.items[index] as PaperItem | undefined
  if (!item) throw notFound("Question")

  const voids = await loadVoids(db, exam.id)
  const [row] = await db.select().from(answers).where(and(eq(answers.attemptId, a.id), eq(answers.itemId, item.itemId)))
  const outcome = itemOutcome(item, row, voids.get(item.itemId))

  const [history, evidence, cohort, related, resolver] = await Promise.all([
    db
      .select({ action: auditLog.action, meta: auditLog.meta, createdAt: auditLog.createdAt, by: user.name })
      .from(auditLog)
      .leftJoin(user, eq(user.id, auditLog.actorId))
      .where(and(eq(auditLog.entityType, "answer"), eq(auditLog.entityId, answerEntity(a.id, item.itemId))))
      .orderBy(desc(auditLog.createdAt)),
    getAttemptEvidence(a.id),
    cohortStats(exam.id, item),
    db
      .select({ status: disputes.status, n: sql<number>`count(*)::int` })
      .from(disputes)
      .where(and(eq(disputes.examId, exam.id), eq(disputes.itemId, item.itemId), ne(disputes.id, d.dispute.id)))
      .groupBy(disputes.status),
    d.dispute.resolvedBy
      ? db.select({ name: user.name }).from(user).where(eq(user.id, d.dispute.resolvedBy)).then((r) => r[0]?.name ?? null)
      : Promise.resolve(null),
  ])

  return {
    exam: { id: exam.id, title: exam.title },
    canAct: actor.role === "examiner" && exam.ownerId === actor.id && d.dispute.status === "open",
    dispute: {
      id: d.dispute.id,
      type: d.dispute.type,
      status: d.dispute.status,
      statement: d.dispute.statement,
      createdAt: d.dispute.createdAt.toISOString(),
      resolvedAt: d.dispute.resolvedAt?.toISOString() ?? null,
      resolutionNote: d.dispute.resolutionNote,
      resolvedBy: resolver,
      marksBefore: d.dispute.marksBefore,
      marksAfter: d.dispute.marksAfter,
    },
    candidate: { name: d.candidate, email: d.email, attemptId: a.id, submittedAt: a.submittedAt?.toISOString() ?? null, submitReason: a.submitReason },
    totals: { score: a.scoreTotal, max: a.maxMarks },
    question: {
      position: index + 1,
      item,
      response: (row?.response ?? null) as AnswerResponse | null,
      savedAt: row?.savedAt?.toISOString() ?? null,
      correct: a.answerKey[item.itemId]?.correct ?? [],
      rubric: a.answerKey[item.itemId]?.rubric ?? null,
      feedback: row?.feedback ?? null,
      awarded: outcome.score,
      overridden: outcome.overridden,
      voided: outcome.voided,
    },
    history: history.map((h) => ({
      at: h.createdAt.toISOString(),
      by: h.by,
      action: h.action,
      from: (h.meta.from as number | null) ?? null,
      to: (h.meta.to as number | null) ?? null,
      reason: (h.meta.reason as string | null) ?? null,
    })),
    evidence,
    cohort,
    related: related.reduce<Record<string, number>>((m, r) => ({ ...m, [r.status]: r.n }), {}),
  }
}

/** How every submitted candidate did on one question (facility, option choices). Sandbox excluded. */
async function cohortStats(examId: string, item: PaperItem) {
  const rows = await db
    .select({ response: answers.response, autoScore: answers.autoScore, manualScore: answers.manualScore })
    .from(attempts)
    .leftJoin(answers, and(eq(answers.attemptId, attempts.id), eq(answers.itemId, item.itemId)))
    .where(
      and(
        eq(attempts.examId, examId),
        eq(attempts.isSandbox, false),
        ne(attempts.status, "in_progress"),
        sql`${attempts.paper}->'items' @> ${JSON.stringify([{ itemId: item.itemId }])}::jsonb`
      )
    )
  let scored = 0
  let answered = 0
  const picks = new Map<string, number>()
  for (const r of rows) {
    const o = itemOutcome(item, r.response === undefined ? undefined : { autoScore: r.autoScore, manualScore: r.manualScore }, null)
    scored += o.score ?? 0
    const resp = r.response as AnswerResponse | null
    if (resp?.kind === "choice" && resp.selected.length) {
      answered++
      for (const id of resp.selected) picks.set(id, (picks.get(id) ?? 0) + 1)
    } else if (resp?.kind === "text" && resp.text.trim()) answered++
  }
  const n = rows.length
  return {
    candidates: n,
    answered,
    facility: n && item.marks ? Math.round((100 * scored) / (n * item.marks)) : null,
    options: item.options.map((o) => ({ id: o.id, text: o.text, picks: picks.get(o.id) ?? 0 })),
  }
}

/**
 * Resolve a dispute (I-5.4). Owner examiner only, open disputes only, results published.
 * - reject: marks unchanged, written reason.
 * - regrade: the candidate's mark for that question changes (written mark, or an
 *   override of the automatic mark for objective questions); totals recalculated and
 *   any issued report whose score changed is marked Replaced.
 * - void: the question is voided for EVERY candidate under one policy, every affected
 *   total is recalculated in the same transaction, and other open disputes on the same
 *   question are closed with the same decision.
 * Lock order: dispute, then attempts in id order. The exam row is read without a lock,
 * as grading does, so this can never deadlock with grading or closing an exam.
 */
export async function resolveDispute(actor: SessionUser, raw: ResolveDisputeInput) {
  if (actor.role !== "examiner") throw new AppError("FORBIDDEN", "Only the exam owner can resolve disputes.")
  const input = resolveDisputeSchema.parse(raw)
  return db.transaction(async (tx) => {
    const [d] = await tx.select().from(disputes).where(eq(disputes.id, input.disputeId)).for("update")
    if (!d) throw notFound("Dispute")
    const exam = await getManagedExam(actor, d.examId, { write: true })
    if (d.status !== "open") throw new AppError("CONFLICT", "This dispute has already been decided.")
    if (!exam.resultsPublishedAt) throw new AppError("CONFLICT", "Results are not published, so there is nothing to dispute yet.")
    const now = new Date()

    if (input.outcome === "reject") {
      await tx
        .update(disputes)
        .set({ status: "rejected", resolutionNote: input.note, resolvedBy: actor.id, resolvedAt: now, marksAfter: d.marksBefore })
        .where(eq(disputes.id, d.id))
      await audit(tx, actor.id, "dispute.resolved", "dispute", d.id, { outcome: "reject", note: input.note, examId: exam.id, attemptId: d.attemptId })
      return { outcome: "reject" as const, affected: 0 }
    }

    if (input.outcome === "regrade") {
      const [a] = await tx.select().from(attempts).where(eq(attempts.id, d.attemptId)).for("update")
      if (!a) throw notFound("Dispute")
      const item = a.paper.items.find((i) => i.itemId === d.itemId)
      if (!item) throw notFound("Question")
      const voids = await loadVoids(tx, exam.id)
      if (voids.has(item.itemId)) throw new AppError("CONFLICT", "This question is voided for everyone, so its marks cannot change.")
      if (input.marks > item.marks)
        throw new AppError("VALIDATION", `Marks cannot exceed ${item.marks} for this question.`, { marks: `Maximum is ${item.marks}.` })
      const [row] = await tx.select().from(answers).where(and(eq(answers.attemptId, a.id), eq(answers.itemId, item.itemId)))
      const before = itemOutcome(item, row, null).score ?? 0
      if (before === input.marks)
        throw new AppError("VALIDATION", "That is the current mark. Choose Reject to keep the marks unchanged.", { marks: "Same as the current mark." })
      if (row)
        await tx
          .update(answers)
          .set({ manualScore: input.marks, gradedBy: actor.id, gradedAt: now })
          .where(and(eq(answers.attemptId, a.id), eq(answers.itemId, item.itemId)))
      else await tx.insert(answers).values({ attemptId: a.id, itemId: item.itemId, response: null, manualScore: input.marks, gradedBy: actor.id, gradedAt: now })
      const totals = await recalcAttempt(tx, a, voids)
      const replaced = await supersedeChangedReports(tx, [a.id])
      // Same entity as manual grading, so the regrade appears in the question's grading history.
      await audit(tx, actor.id, "grade.regraded", "answer", answerEntity(a.id, item.itemId), {
        examId: exam.id,
        from: before,
        to: input.marks,
        max: item.marks,
        reason: `Dispute upheld: ${input.note}`,
        disputeId: d.id,
        override: item.type !== "written",
      })
      await tx
        .update(disputes)
        .set({ status: "regraded", resolutionNote: input.note, resolvedBy: actor.id, resolvedAt: now, marksBefore: before, marksAfter: input.marks })
        .where(eq(disputes.id, d.id))
      await audit(tx, actor.id, "dispute.resolved", "dispute", d.id, {
        outcome: "regrade",
        note: input.note,
        from: before,
        to: input.marks,
        newTotal: totals.scoreTotal,
        reportsReplaced: replaced,
        examId: exam.id,
        attemptId: a.id,
      })
      return { outcome: "regrade" as const, affected: 1, newTotal: totals.scoreTotal, reportsReplaced: replaced }
    }

    // Void for everyone: one rule, applied to every paper containing the question.
    const [already] = await tx.select().from(itemVoids).where(and(eq(itemVoids.examId, exam.id), eq(itemVoids.itemId, d.itemId)))
    if (already) throw new AppError("CONFLICT", "This question is already voided for everyone.")
    const affectedAttempts = await tx
      .select()
      .from(attempts)
      .where(
        and(
          eq(attempts.examId, exam.id),
          eq(attempts.isSandbox, false),
          ne(attempts.status, "in_progress"),
          sql`${attempts.paper}->'items' @> ${JSON.stringify([{ itemId: d.itemId }])}::jsonb`
        )
      )
      .orderBy(asc(attempts.id))
      .for("update")
    await tx.insert(itemVoids).values({
      examId: exam.id,
      itemId: d.itemId,
      policy: input.policy,
      reason: input.note,
      disputeId: d.id,
      voidedBy: actor.id,
      affected: affectedAttempts.length,
    })
    const voids = await loadVoids(tx, exam.id)
    const changes: { attemptId: string; from: number | null; to: number; maxFrom: number; maxTo: number }[] = []
    let candidateBefore: number | null = null
    let candidateAfter: number | null = null
    for (const a of affectedAttempts) {
      const t = await recalcAttempt(tx, a, voids)
      changes.push({ attemptId: a.id, from: a.scoreTotal, to: t.scoreTotal, maxFrom: a.maxMarks, maxTo: t.maxMarks })
      if (a.id === d.attemptId) {
        const item = a.paper.items.find((i) => i.itemId === d.itemId)!
        const [row] = await tx.select().from(answers).where(and(eq(answers.attemptId, a.id), eq(answers.itemId, d.itemId)))
        candidateBefore = itemOutcome(item, row, null).score
        candidateAfter = itemOutcome(item, row, input.policy as VoidRule).score
      }
    }
    const replaced = await supersedeChangedReports(
      tx,
      affectedAttempts.map((a) => a.id)
    )
    await tx
      .update(disputes)
      .set({ status: "voided", resolutionNote: input.note, resolvedBy: actor.id, resolvedAt: now, marksBefore: candidateBefore, marksAfter: candidateAfter })
      .where(eq(disputes.id, d.id))
    // Everyone else who disputed the same question gets the same decision.
    const others = await tx
      .update(disputes)
      .set({
        status: "voided",
        resolutionNote: `Resolved together with other disputes on this question: ${input.note}`,
        resolvedBy: actor.id,
        resolvedAt: now,
      })
      .where(and(eq(disputes.examId, exam.id), eq(disputes.itemId, d.itemId), eq(disputes.status, "open"), ne(disputes.id, d.id)))
      .returning({ id: disputes.id })
    await audit(tx, actor.id, "question.voided", "exam", exam.id, {
      itemId: d.itemId,
      policy: input.policy,
      reason: input.note,
      disputeId: d.id,
      affected: affectedAttempts.length,
      reportsReplaced: replaced,
      alsoClosed: others.map((o) => o.id),
      changes,
    })
    await audit(tx, actor.id, "dispute.resolved", "dispute", d.id, { outcome: "void", policy: input.policy, note: input.note, examId: exam.id, attemptId: d.attemptId })
    return { outcome: "void" as const, affected: affectedAttempts.length, alsoClosed: others.length, reportsReplaced: replaced }
  })
}

/** Exam-level void list for the results screen and analytics badges. */
export async function listVoids(actor: SessionUser, examId: string) {
  await getManagedExam(actor, examId)
  return db.select().from(itemVoids).where(eq(itemVoids.examId, examId))
}

