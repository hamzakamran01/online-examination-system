import "server-only"
import { randomBytes } from "node:crypto"
import { and, eq, inArray, isNull, ne, sql } from "drizzle-orm"
import { db, type Tx } from "@/server/db/client"
import { attempts, answers, exams, user, resultReports } from "@/server/db/schema"
import type { SessionUser } from "@/server/auth/guards"
import { notFound } from "@/server/errors"
import { getManagedExam } from "./exams"
import { loadVoids } from "./attempts"
import { itemOutcome } from "@/lib/domain/scoring"
export async function getResultReport(actor: SessionUser, attemptId: string) {
  return db.transaction(async (tx) => {
    const [a] = await tx
      .select({
        id: attempts.id,
        examId: attempts.examId,
        name: user.name,
        paper: attempts.paper,
        submitted: attempts.submittedAt,
        total: attempts.scoreTotal,
        max: attempts.maxMarks,
        title: exams.title,
        passMark: exams.passMark,
        grading: attempts.gradingStatus,
      })
      .from(attempts)
      .innerJoin(exams, eq(exams.id, attempts.examId))
      .innerJoin(user, eq(user.id, attempts.candidateId))
      .where(
        and(
          eq(attempts.id, attemptId),
          eq(attempts.isSandbox, false),
          ne(attempts.status, "in_progress"),
          actor.role === "candidate" ? eq(attempts.candidateId, actor.id) : undefined,
          actor.role === "examiner" ? eq(exams.ownerId, actor.id) : undefined,
        ),
      )
      .for("update", { of: attempts })
    if (!a) throw notFound("Report")
    if (actor.role === "candidate") {
      const [e] = await tx
        .select({ published: exams.resultsPublishedAt })
        .from(exams)
        .where(eq(exams.id, a.examId))
        .for("share")
      if (!e?.published) throw notFound("Report")
    } else await getManagedExam(actor, a.examId, { tx })
    const [existing] = await tx
      .select()
      .from(resultReports)
      .where(and(eq(resultReports.attemptId, a.id), isNull(resultReports.revokedAt)))
    const total = a.total ?? 0
    // An updated grade needs a new snapshot so the PDF agrees with its verification page.
    if (existing && (existing.scoreSnapshot !== total || existing.maxSnapshot !== a.max))
      await tx.update(resultReports).set({ revokedAt: new Date() }).where(eq(resultReports.id, existing.id))
    const report =
      existing && existing.scoreSnapshot === total && existing.maxSnapshot === a.max
        ? existing
        : (
            await tx
              .insert(resultReports)
              .values({
                attemptId: a.id,
                issuedBy: actor.id,
                code: randomBytes(16).toString("base64url"),
                scoreSnapshot: total,
                maxSnapshot: a.max,
              })
              .returning()
          )[0]
    const rows = await tx
      .select({ itemId: answers.itemId, auto: answers.autoScore, manual: answers.manualScore })
      .from(answers)
      .where(eq(answers.attemptId, a.id))
    const scores = new Map(rows.map((r) => [r.itemId, { autoScore: r.auto, manualScore: r.manual }]))
    const voids = await loadVoids(tx, a.examId)
    return {
      name: a.name,
      title: a.title,
      submitted: a.submitted,
      grading: a.grading,
      score: total,
      max: a.max,
      passMark: a.passMark,
      code: report.code,
      issued: report.issuedAt,
      items: a.paper.items.map((item) => {
        const o = itemOutcome(item, scores.get(item.itemId), voids.get(item.itemId))
        return { type: o.voided ? `${item.type} (voided)` : item.type, max: o.max, score: o.score }
      }),
    }
  })
}
export type ResultReport = Awaited<ReturnType<typeof getResultReport>>

/**
 * After a post-publication change (regrade, void), every issued report whose snapshot no
 * longer matches the recalculated total is marked Replaced at once, so an old PDF's QR code
 * stops vouching for an outdated score immediately, not only when a new PDF is downloaded.
 */
export async function supersedeChangedReports(tx: Tx, attemptIds: string[]) {
  if (!attemptIds.length) return 0
  const rows = await tx
    .update(resultReports)
    .set({ revokedAt: new Date() })
    .where(
      and(
        inArray(resultReports.attemptId, attemptIds),
        isNull(resultReports.revokedAt),
        sql`exists (select 1 from ${attempts} a where a.id = ${resultReports.attemptId} and (a.score_total is distinct from ${resultReports.scoreSnapshot} or a.max_marks <> ${resultReports.maxSnapshot}))`
      )
    )
    .returning({ id: resultReports.id })
  return rows.length
}
