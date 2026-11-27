/**
 * Attempt-engine integrity checks against a disposable database branch.
 * Run: DATABASE_URL=<test branch> pnpm exec tsx --conditions=react-server scripts/verify-attempt-engine.ts
 * Never point this at the demo database: it creates attempts and moves deadlines.
 */
import { eq, sql } from "drizzle-orm"
import { db } from "@/server/db/client"
import { attempts, attemptEvents, enrollments, exams, user } from "@/server/db/schema"
import { getAttemptView, saveAnswers, startAttempt, submitAttempt, DEADLINE_GRACE_MS } from "@/server/services/attempts"
import type { SessionUser } from "@/server/auth/guards"

let failures = 0
const check = (label: string, ok: boolean, detail = "") => {
  if (!ok) failures++
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? `  (${detail})` : ""}`)
}
async function expectError(label: string, fn: () => Promise<unknown>, code: string) {
  try {
    await fn()
    check(label, false, "no error thrown")
  } catch (e) {
    const got = (e as { code?: string }).code
    check(label, got === code, `got ${got}`)
  }
}

async function main() {
  if (!process.env.DATABASE_URL?.includes("ep-")) throw new Error("DATABASE_URL missing")
  const [u] = await db.select().from(user).where(eq(user.email, "bilal@examvault.test"))
  const [other] = await db.select().from(user).where(eq(user.email, "sara@examvault.test"))
  const bilal: SessionUser = { id: u.id, name: u.name, email: u.email, role: "candidate" }
  const sara: SessionUser = { id: other.id, name: other.name, email: other.email, role: "candidate" }
  const [exam] = await db.select().from(exams).where(eq(exams.title, "Web Engineering Quiz"))

  // Clean slate for Bilal on this exam (test branch only).
  await db.delete(attempts).where(sql`${attempts.examId} = ${exam.id} and ${attempts.candidateId} = ${bilal.id}`)

  // 1. Start is idempotent: two concurrent starts return the same attempt.
  const [s1, s2] = await Promise.all([startAttempt(bilal, exam.id), startAttempt(bilal, exam.id)])
  check("concurrent start returns one attempt", s1.attemptId === s2.attemptId)

  // 2. Not enrolled candidate cannot start; foreign attempt is invisible.
  await db.delete(enrollments).where(sql`${enrollments.examId} = ${exam.id} and ${enrollments.candidateId} = ${sara.id}`)
  await expectError("non-enrolled candidate cannot start", () => startAttempt(sara, exam.id), "NOT_FOUND")
  await expectError("other candidate cannot read attempt", () => getAttemptView(sara, s1.attemptId), "NOT_FOUND")

  // 3. Candidate view never contains the answer key.
  const view = await getAttemptView(bilal, s1.attemptId)
  const json = JSON.stringify(view)
  check("view has no answerKey / isCorrect", !json.includes("answerKey") && !json.includes("isCorrect") && !json.includes('"correct"'))
  const item = view.paper.items.find((i) => i.type === "single")!

  // 4. Order-safe saves: an older sequence never overwrites a newer one.
  await saveAnswers(bilal, s1.attemptId, { clientId: "device-a-123", answers: [{ itemId: item.itemId, response: { kind: "choice", selected: [item.options[1].id] }, flagged: false, seq: 5 }] })
  await saveAnswers(bilal, s1.attemptId, { clientId: "device-a-123", answers: [{ itemId: item.itemId, response: { kind: "choice", selected: [item.options[0].id] }, flagged: false, seq: 3 }] })
  const after = await getAttemptView(bilal, s1.attemptId)
  check("stale seq ignored", after.answers[item.itemId]?.response?.kind === "choice" && (after.answers[item.itemId].response as { selected: string[] }).selected[0] === item.options[1].id)

  // 5. Invalid option id is rejected.
  await expectError("option from another question rejected", () => saveAnswers(bilal, s1.attemptId, { clientId: "device-a-123", answers: [{ itemId: item.itemId, response: { kind: "choice", selected: ["00000000-0000-4000-8000-000000000000"] }, flagged: false, seq: 9 }] }), "VALIDATION")

  // 6. Grace: a save 2 s after the deadline is accepted.
  await db.update(attempts).set({ deadlineAt: new Date(Date.now() - 2_000) }).where(eq(attempts.id, s1.attemptId))
  let graceOk = true
  try {
    await saveAnswers(bilal, s1.attemptId, { clientId: "device-a-123", answers: [{ itemId: item.itemId, response: { kind: "choice", selected: [item.options[2].id] }, flagged: true, seq: 10 }] })
  } catch {
    graceOk = false
  }
  check(`save inside ${DEADLINE_GRACE_MS / 1000} s grace accepted`, graceOk)

  // 7. After the grace: rejected, logged, finalized with submitted_at = deadline.
  const deadline = new Date(Date.now() - DEADLINE_GRACE_MS - 1_000)
  await db.update(attempts).set({ deadlineAt: deadline }).where(eq(attempts.id, s1.attemptId))
  await expectError("save after grace rejected", () => saveAnswers(bilal, s1.attemptId, { clientId: "device-a-123", answers: [{ itemId: item.itemId, response: null, flagged: false, seq: 11 }] }), "DEADLINE_PASSED")
  const [final] = await db.select().from(attempts).where(eq(attempts.id, s1.attemptId))
  check("attempt auto-submitted", final.status === "auto_submitted")
  check("submitted_at equals deadline", final.submittedAt?.getTime() === deadline.getTime())
  check("grace-window answer counted", final.scoreAuto !== null)
  const events = await db.select().from(attemptEvents).where(eq(attemptEvents.attemptId, s1.attemptId))
  check("late save logged", events.some((e) => e.type === "late_save_rejected"))

  // 8. Submit is idempotent.
  const r1 = await submitAttempt(bilal, s1.attemptId)
  const r2 = await submitAttempt(bilal, s1.attemptId)
  check("repeat submit is a no-op", r1.alreadySubmitted && r2.alreadySubmitted && r2.status === "auto_submitted")

  // 9. One real attempt per candidate: restarting after submission is refused.
  await expectError("cannot start a second real attempt", () => startAttempt(bilal, exam.id), "CONFLICT")

  console.log(failures ? `\n${failures} check(s) FAILED` : "\nAll checks passed")
  process.exit(failures ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
