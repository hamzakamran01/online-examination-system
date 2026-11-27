import "server-only"
import { randomInt, randomUUID } from "node:crypto"
import { hashPassword } from "better-auth/crypto"
import { inArray } from "drizzle-orm"
import { db } from "@/server/db/client"
import { account as credentials, enrollments, questions, questionOptions, topics, user } from "@/server/db/schema"
import type { SessionUser } from "@/server/auth/guards"
import { AppError } from "@/server/errors"
import { effectiveStatus } from "@/lib/domain/exam-status"
import { importSchema, readRows, candidateRow, questionRow, type Upload, type Outcome } from "@/lib/validation/imports"
import { getManagedExam } from "./exams"
import { audit } from "./audit"

function generatePassword(): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
  const value = Array.from({ length: 12 }, () => chars[randomInt(chars.length)]).join("")
  return /[0-9]/.test(value) && /[a-z]/i.test(value) ? value : generatePassword()
}
export async function processImport(actor: SessionUser, raw: Upload, commit: boolean) {
  if (actor.role !== "examiner") throw new AppError("FORBIDDEN", "Examiner access required.")
  const input = importSchema.parse(raw)
  let rows: ReturnType<typeof readRows>
  try {
    rows = readRows(input)
  } catch (e) {
    throw new AppError("VALIDATION", (e as Error).message)
  }
  const candidateRows =
    input.kind === "candidates"
      ? rows.flatMap(({ value, error }) => {
          if (error || !value || typeof value !== "object" || Array.isArray(value)) return []
          const parsed = candidateRow(value as Record<string, unknown>)
          return parsed.success ? [parsed.data] : []
        })
      : []
  const emails = [...new Set(candidateRows.map((r) => r.email))]
  const prepared = new Map<
    string,
    { id: string; name: string; email: string; secret: string; generated: boolean; hash: string }
  >()
  if (commit && emails.length) {
    if (input.examId) await getManagedExam(actor, input.examId)
    const present = await db.select({ email: user.email }).from(user).where(inArray(user.email, emails))
    const known = new Set(present.map((r) => r.email))
    const fresh = candidateRows.filter((r) => {
      if (known.has(r.email)) return false
      known.add(r.email)
      return true
    })
    for (let i = 0; i < fresh.length; i += 8) {
      await Promise.all(
        fresh.slice(i, i + 8).map(async (r) => {
          const secret = r.password ?? generatePassword()
          prepared.set(r.email, {
            id: randomUUID(),
            name: r.name,
            email: r.email,
            secret,
            generated: !r.password,
            hash: await hashPassword(secret),
          })
        }),
      )
    }
  }
  return db.transaction(async (tx) => {
    const outcome: Outcome = {
      rows: [],
      imported: 0,
      passwords: [],
      created: 0,
      reused: 0,
      enrolled: 0,
      questions: 0,
      skipped: 0,
    }
    const exam =
      input.kind === "candidates" && input.examId
        ? await getManagedExam(actor, input.examId, { write: true, tx })
        : null
    if (exam && effectiveStatus(exam) === "completed") throw new AppError("CONFLICT", "Enrollment is closed.")
    const existing =
      emails.length && input.kind === "candidates"
        ? await tx
            .select({ id: user.id, email: user.email, role: user.role, active: user.active })
            .from(user)
            .where(inArray(user.email, emails))
            .for("share")
        : []
    const accounts = new Map(existing.map((a) => [a.email, a]))
    const fresh = [...prepared.values()].filter((r) => !accounts.has(r.email))
    if (fresh.length) {
      await tx
        .insert(user)
        .values(fresh.map(({ id, name, email }) => ({ id, name, email, role: "candidate" as const, emailVerified: true })))
      await tx
        .insert(credentials)
        .values(
          fresh.map((r) => ({
            id: randomUUID(),
            accountId: r.id,
            userId: r.id,
            providerId: "credential",
            password: r.hash,
          })),
        )
    }
    const enrollmentRows: (typeof enrollments.$inferInsert)[] = []
    const seen = new Set<string>()
    for (const { line, value, error } of rows) {
      const row = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
      const errors: string[] = error ? [error] : []
      const visible =
        input.kind === "candidates"
          ? [row.name, row.email]
          : [row.type, row.topic, row.difficulty, row.marks, row.stem, row.options, row.correct, row.scheme, row.rubric]
      outcome.rows.push({
        line,
        values: visible
          .filter((v) => v != null && v !== "")
          .map(String)
          .join(" · "),
        errors,
      })
      if (input.kind === "candidates") {
        const parsed = candidateRow(row)
        if (!parsed.success) {
          errors.push(...parsed.error.issues.map((i) => i.path.join(".") + ": " + i.message))
          continue
        }
        const { email } = parsed.data
        const account = accounts.get(email)
        if (account && account.role !== "candidate") errors.push("email: This account is reserved for staff.")
        if (exam && account && !account.active) errors.push("email: Inactive candidates cannot enroll.")
        if (seen.has(email)) errors.push("email: Duplicate email in this file.")
        if (errors.length) continue
        seen.add(email)
        if (!commit) continue
        const generated = prepared.get(email)
        if (!account && !generated)
          throw new AppError("CONFLICT", "An account changed during import. Preview the file and try again.")
        if (account) outcome.reused++
        else {
          outcome.created++
          if (generated!.generated) outcome.passwords.push({ email, password: generated!.secret })
        }
        if (exam)
          enrollmentRows.push({ examId: exam.id, candidateId: account?.id ?? generated!.id, enrolledBy: actor.id })
      } else {
        const { parsed, invalidIndex } = questionRow(row)
        if (invalidIndex) errors.push("correct: Use valid 1-based option indexes.")
        if (!parsed.success) {
          errors.push(...parsed.error.issues.map((i) => i.path.join(".") + ": " + i.message))
          continue
        }
        if (!commit || errors.length) continue
        const q = parsed.data
        const [topic] = q.topicName
          ? await tx
              .insert(topics)
              .values({ ownerId: actor.id, name: q.topicName })
              .onConflictDoUpdate({ target: [topics.ownerId, topics.name], set: { name: q.topicName } })
              .returning({ id: topics.id })
          : []
        const [created] = await tx
          .insert(questions)
          .values({
            ownerId: actor.id,
            topicId: topic?.id,
            type: q.type,
            difficulty: q.difficulty,
            stem: q.stem,
            defaultMarks: q.defaultMarks,
            rubric: q.type === "written" ? q.rubric || null : null,
            multiScheme: q.type === "multi" ? q.multiScheme : "all_or_nothing",
          })
          .returning({ id: questions.id })
        if (q.options.length)
          await tx
            .insert(questionOptions)
            .values(q.options.map((o, position) => ({ ...o, position, questionId: created.id })))
        outcome.questions++
      }
      outcome.imported++
    }
    if (enrollmentRows.length)
      outcome.enrolled = (
        await tx
          .insert(enrollments)
          .values(enrollmentRows)
          .onConflictDoNothing()
          .returning({ id: enrollments.candidateId })
      ).length
    outcome.skipped = outcome.rows.filter((r) => r.errors.length).length
    if (commit && outcome.imported)
      await audit(tx, actor.id, "import.completed", input.kind, exam?.id ?? actor.id, { count: outcome.imported })
    return outcome
  })
}

