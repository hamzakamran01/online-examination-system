import "server-only"
import { and, eq } from "drizzle-orm"
import { z } from "zod"
import { db } from "@/server/db/client"
import { resultReports, attempts, exams, user } from "@/server/db/schema"
export async function verifyReport(code: string) {
  if (
    !z
      .string()
      .regex(/^[A-Za-z0-9_-]{22}$/)
      .safeParse(code).success
  )
    return null
  const [r] = await db
    .select({
      title: exams.title,
      name: user.name,
      score: resultReports.scoreSnapshot,
      max: resultReports.maxSnapshot,
      issued: resultReports.issuedAt,
      revoked: resultReports.revokedAt,
    })
    .from(resultReports)
    .innerJoin(attempts, eq(attempts.id, resultReports.attemptId))
    .innerJoin(exams, eq(exams.id, attempts.examId))
    .innerJoin(user, eq(user.id, attempts.candidateId))
    .where(and(eq(resultReports.code, code), eq(attempts.isSandbox, false)))
  if (!r) return null
  const names = r.name.trim().split(/\s+/u)
  return {
    title: r.title,
    name: names.length > 1 ? names[0] + " " + Array.from(names.at(-1)!)[0] + "." : names[0],
    score: r.score,
    max: r.max,
    issued: r.issued,
    status: r.revoked ? "Revoked" : "Valid",
  }
}
