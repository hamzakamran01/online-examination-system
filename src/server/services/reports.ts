import "server-only"
import { randomBytes } from "node:crypto"
import { and, eq, isNull, ne } from "drizzle-orm"
import { db } from "@/server/db/client"
import { attempts, answers, exams, user, resultReports } from "@/server/db/schema"
import type { SessionUser } from "@/server/auth/guards"
import { notFound } from "@/server/errors"
import { getManagedExam } from "./exams"
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
    const scores = new Map(rows.map((r) => [r.itemId, r]))
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
        const answer = scores.get(item.itemId)
        return {
          type: item.type,
          max: item.marks,
          score:
            item.type === "written" ? (answer?.manual ?? (a.grading === "graded" ? 0 : null)) : (answer?.auto ?? 0),
        }
      }),
    }
  })
}
export type ResultReport = Awaited<ReturnType<typeof getResultReport>>
