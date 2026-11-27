/**
 * Grading and results integrity checks against a disposable database branch.
 * Run: pnpm verify:grading   (uses .env.test; never the demo database)
 * Stateful: run once per fresh test branch. Needs one finalized attempt with a written answer (the Walkthrough Quiz from the browser walkthrough).
 */
import { and, eq } from "drizzle-orm"
import { ZodError } from "zod"
import { db } from "@/server/db/client"
import { attempts, exams, user } from "@/server/db/schema"
import type { SessionUser } from "@/server/auth/guards"
import { getCandidateResult, getGradingAttempt, getResultsOverview, gradeAnswer, publishResults } from "@/server/services/grading"
import { closeExam } from "@/server/services/exams"
import { finalizeAllForExam } from "@/server/services/attempts"
import { scoreItem } from "@/server/domain/grading"
import type { PaperItem } from "@/lib/domain/paper"

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
    // Schema-level rejections surface as ZodError; the action layer maps them to VALIDATION.
    const got = e instanceof ZodError ? "VALIDATION" : (e as { code?: string }).code
    check(label, got === code, `got ${got}`)
  }
}
const asUser = async (email: string): Promise<SessionUser> => {
  const [u] = await db.select().from(user).where(eq(user.email, email))
  return { id: u.id, name: u.name, email: u.email, role: u.role }
}

function pureMarkingRules() {
  const single: PaperItem = { itemId: "s", type: "single", stem: "", marks: 2, scheme: "all_or_nothing", topic: null, difficulty: "easy", options: [{ id: "a", text: "" }, { id: "b", text: "" }] }
  const multi = (scheme: "all_or_nothing" | "partial"): PaperItem => ({ ...single, type: "multi", marks: 3, scheme, options: ["a", "b", "c", "d"].map((id) => ({ id, text: "" })) })
  const key = { correct: ["a", "c", "d"] }
  const pick = (...selected: string[]) => ({ kind: "choice" as const, selected })
  check("single correct = full", scoreItem(single, { correct: ["a"] }, pick("a")) === 2)
  check("single wrong = 0", scoreItem(single, { correct: ["a"] }, pick("b")) === 0)
  check("single unanswered = 0", scoreItem(single, { correct: ["a"] }, null) === 0)
  check("all-or-nothing exact = full", scoreItem(multi("all_or_nothing"), key, pick("a", "c", "d")) === 3)
  check("all-or-nothing subset = 0", scoreItem(multi("all_or_nothing"), key, pick("a", "c")) === 0)
  check("all-or-nothing superset = 0", scoreItem(multi("all_or_nothing"), key, pick("a", "b", "c", "d")) === 0)
  check("partial 2 of 3 right = 2", scoreItem(multi("partial"), key, pick("a", "c")) === 2)
  check("partial 1 right 1 wrong = 0", scoreItem(multi("partial"), key, pick("a", "b")) === 0)
  check("partial select everything = 2 (3 right minus 1 wrong)", scoreItem(multi("partial"), key, pick("a", "b", "c", "d")) === 2)
  check("partial never negative", scoreItem(multi("partial"), { correct: ["a"] }, pick("b", "c", "d")) === 0)
  check("written returns null (manual)", scoreItem({ ...single, type: "written" }, { correct: [] }, { kind: "text", text: "x" }) === null)
}

async function main() {
  if (!process.env.DATABASE_URL?.includes("ep-")) throw new Error("DATABASE_URL missing")
  pureMarkingRules()

  const examiner = await asUser("examiner@examvault.test")
  const examiner2 = await asUser("examiner2@examvault.test")
  const ayesha = await asUser("ayesha@examvault.test")
  const sara = await asUser("sara@examvault.test")
  const [exam] = await db.select().from(exams).where(eq(exams.title, "Walkthrough Quiz"))
  if (!exam) throw new Error("Run the browser walkthrough first (Walkthrough Quiz missing)")
  const [a] = await db.select().from(attempts).where(and(eq(attempts.examId, exam.id), eq(attempts.candidateId, ayesha.id), eq(attempts.isSandbox, false)))
  const written = a.paper.items.find((i) => i.type === "written")!

  // Access control.
  await expectError("other examiner cannot open the grading view", () => getGradingAttempt(examiner2, exam.id, a.id), "NOT_FOUND")
  await expectError("other examiner cannot grade", () => gradeAnswer(examiner2, { attemptId: a.id, itemId: written.itemId, marks: 1 }), "NOT_FOUND")
  await expectError("candidate cannot grade", () => gradeAnswer(ayesha, { attemptId: a.id, itemId: written.itemId, marks: 4 }), "FORBIDDEN")
  await expectError("another candidate cannot read the result", () => getCandidateResult(sara, a.id), "NOT_FOUND")

  // Before publication the candidate sees only their own answers.
  const before = await getCandidateResult(ayesha, a.id)
  check("unpublished: no score", before.score === null && before.items.every((i) => i.marks === null && i.correct === null && i.feedback === null))
  check("unpublished: own answers visible", before.items.some((i) => i.response !== null))
  check("unpublished: no answer key in payload", !JSON.stringify(before).includes("answerKey"))

  // Validation against the frozen paper.
  await expectError("marks above maximum rejected", () => gradeAnswer(examiner, { attemptId: a.id, itemId: written.itemId, marks: written.marks + 1 }), "VALIDATION")
  await expectError("negative marks rejected", () => gradeAnswer(examiner, { attemptId: a.id, itemId: written.itemId, marks: -1 }), "VALIDATION")
  await expectError("quarter marks rejected", () => gradeAnswer(examiner, { attemptId: a.id, itemId: written.itemId, marks: 1.25 }), "VALIDATION")
  const objective = a.paper.items.find((i) => i.type !== "written")!
  await expectError("objective items cannot be hand-graded", () => gradeAnswer(examiner, { attemptId: a.id, itemId: objective.itemId, marks: 1 }), "VALIDATION")

  // Publish gate while ungraded.
  await expectError("publish blocked while ungraded or window open", () => publishResults(examiner, exam.id), "CONFLICT")

  // Grade, totals recalculated in the same transaction.
  const [pre] = await db.select().from(attempts).where(eq(attempts.id, a.id))
  const g = await gradeAnswer(examiner, { attemptId: a.id, itemId: written.itemId, marks: 3.5, feedback: "Good explanation of resolution; mention caching." })
  check("grade saved, attempt now graded", !g.unchanged && "gradingStatus" in g && g.gradingStatus === "graded")
  const [post] = await db.select().from(attempts).where(eq(attempts.id, a.id))
  check("total = auto + manual", post.scoreTotal === Math.round(((post.scoreAuto ?? 0) + (post.scoreManual ?? 0)) * 100) / 100, `${post.scoreAuto} + ${post.scoreManual} = ${post.scoreTotal}`)
  check("total rose by the manual mark", (post.scoreTotal ?? 0) - (pre.scoreTotal ?? 0) === 3.5)
  const same = await gradeAnswer(examiner, { attemptId: a.id, itemId: written.itemId, marks: 3.5, feedback: "Good explanation of resolution; mention caching." })
  check("identical save is a no-op", same.unchanged === true)
  const view = await getGradingAttempt(examiner, exam.id, a.id)
  check("grading history recorded", view.items.find((i) => i.item.itemId === written.itemId)!.history.length === 1)

  // Window still open: publish blocked even when fully graded.
  const ov = await getResultsOverview(examiner, exam.id)
  check("publish blocked while window open", !ov.canPublish && ov.blockers.some((b) => b.includes("window")))

  // Close the exam (ends window), then publish.
  await closeExam(examiner, exam.id, finalizeAllForExam)
  const ov2 = await getResultsOverview(examiner, exam.id)
  check("after close and grading, publish allowed", ov2.canPublish, ov2.blockers.join("; "))
  await publishResults(examiner, exam.id)
  await expectError("publishing twice is refused", () => publishResults(examiner, exam.id), "CONFLICT")

  // Candidate sees score, feedback; key hidden because releaseAnswerReview is off.
  const after = await getCandidateResult(ayesha, a.id)
  check("published: score visible", after.score === post.scoreTotal)
  check("published: feedback visible", after.items.some((i) => i.feedback?.includes("caching")))
  check("published: correct options hidden (review disabled)", after.items.every((i) => i.correct === null))

  // Regrade after publication requires a reason and is recorded.
  await expectError("regrade without reason refused", () => gradeAnswer(examiner, { attemptId: a.id, itemId: written.itemId, marks: 4 }), "VALIDATION")
  const rg = await gradeAnswer(examiner, { attemptId: a.id, itemId: written.itemId, marks: 4, reason: "Rubric point on caching was present on re-read" })
  check("regrade with reason saved", !rg.unchanged)
  const after2 = await getCandidateResult(ayesha, a.id)
  check("candidate sees regraded score", after2.score === (post.scoreTotal ?? 0) + 0.5)
  const view2 = await getGradingAttempt(examiner, exam.id, a.id)
  const hist = view2.items.find((i) => i.item.itemId === written.itemId)!.history
  check("regrade reason in history", hist.length === 2 && hist[0].reason?.includes("caching") === true)

  console.log(failures ? `\n${failures} check(s) FAILED` : "\nAll checks passed")
  process.exit(failures ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
