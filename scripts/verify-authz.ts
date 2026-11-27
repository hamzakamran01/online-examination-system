import { randomUUID } from "node:crypto"
import { eq, inArray, or } from "drizzle-orm"
import { db } from "@/server/db/client"
import { auditLog, exams, questions, user, userPreferences } from "@/server/db/schema"
import type { SessionUser } from "@/server/auth/guards"
import * as exam from "@/server/services/exams"
import * as attempt from "@/server/services/attempts"
import * as enrollment from "@/server/services/enrollments"
import * as grading from "@/server/services/grading"
import * as monitor from "@/server/services/monitoring"
import * as bank from "@/server/services/questions"
import * as users from "@/server/services/users"
import * as workspace from "@/server/services/workspace"
import { listAudit } from "@/server/services/audit"
import { getExamAnalytics } from "@/server/services/analytics"
import { getResultReport } from "@/server/services/reports"
import { getPlatformOverview } from "@/server/services/platform"
import { processImport } from "@/server/services/imports"
import { defaults } from "@/lib/validation/workspace"

type Outcome = "OK" | "FORBIDDEN" | "NOT_FOUND"
const matrix: Record<string, string>[] = []
let failures = 0

async function check<T>(
  service: string,
  actor: string,
  expected: Outcome,
  run: () => Promise<T>,
  verify?: (value: T) => boolean,
) {
  let actual: string
  try {
    const value = await run()
    actual = !verify || verify(value) ? "OK" : "INVALID_RESPONSE"
  } catch (error) {
    actual = (error as { code?: string }).code ?? "INTERNAL"
  }
  const pass = actual === expected
  if (!pass) failures++
  matrix.push({ service, actor, expected, actual })
  console.log(`${pass ? "PASS" : "FAIL"} ${service} / ${actor} (${actual}, expected ${expected})`)
}
const reactivated: string[] = []
async function loadActor(handle: string): Promise<SessionUser> {
  const [row] = await db
    .select()
    .from(user)
    .where(eq(user.email, handle + "@examvault.test"))
  if (!row) throw Error("Missing fixture account " + handle)
  // An earlier admin walkthrough may have deactivated a seeded account. Enrollment correctly refuses
  // inactive candidates, so reactivate it for this run and restore the original state at the end.
  if (!row.active) {
    await db.update(user).set({ active: true }).where(eq(user.id, row.id))
    reactivated.push(row.id)
  }
  return { id: row.id, role: row.role, name: row.name, email: row.email }
}

async function main() {
  const url = process.env.DATABASE_URL
  if (!url || url.includes("ep-old-flower")) throw Error("An isolated database is required.")
  const [owner, peer, admin, candidate, other, outsider] = await Promise.all(
    ["examiner", "examiner2", "admin", "ayesha", "bilal", "sara"].map(loadActor),
  )
  const ids: string[] = []
  const prefix = "Authorization fixture " + randomUUID()
  const questionIds: string[] = []
  const attemptAuditIds: string[] = []
  let fixtureUser: string | undefined
  const now = Date.now()
  const settings = {
    title: prefix,
    startsAt: new Date(now).toISOString(),
    endsAt: new Date(now + 7_200_000).toISOString(),
    durationMin: 60,
    totalMarks: 2,
    releaseAnswerReview: false,
  }
  try {
    const { id: itemId } = await bank.saveQuestion(owner, {
      type: "written",
      difficulty: "easy",
      defaultMarks: 2,
      stem: prefix,
    })
    questionIds.push(itemId)
    const { id } = await exam.createExam(owner, settings)
    ids.push(id)
    const assignment = { examId: id, items: [{ questionId: itemId, marks: 2 }] }
    const studentList = { examId: id, candidateIds: [candidate.id, other.id] }
    const password = "Fixture2026!"
    const newUser = {
      name: prefix.slice(0, 70),
      email: randomUUID() + "@example.test",
      password,
      role: "candidate" as const,
    }
    const upload = {
      kind: "candidates" as const,
      format: "json" as const,
      examId: id,
      source: JSON.stringify([{ name: candidate.name, email: candidate.email }]),
    }

    async function examinerRead<T>(
      name: string,
      run: (actor: SessionUser) => Promise<T>,
      verify?: (value: T) => boolean,
    ) {
      await check(name, "candidate", "NOT_FOUND", () => run(candidate))
      await check(name, "foreign examiner", "NOT_FOUND", () => run(peer))
      await check(name, "admin", "OK", () => run(admin), verify)
      await check(name, "owner", "OK", () => run(owner))
    }
    async function examinerWrite(
      name: string,
      run: (actor: SessionUser) => Promise<unknown>,
      wrong: Outcome = "NOT_FOUND",
    ) {
      await check(name, "candidate", wrong, () => run(candidate))
      await check(name, "foreign examiner", "NOT_FOUND", () => run(peer))
      await check(name, "admin", wrong, () => run(admin))
      await check(name, "owner", "OK", () => run(owner))
    }
    async function adminOnly(name: string, run: (actor: SessionUser) => Promise<unknown>) {
      await check(name, "examiner", "FORBIDDEN", () => run(owner))
      await check(name, "candidate", "FORBIDDEN", () => run(candidate))
      await check(name, "admin", "OK", () => run(admin))
    }
    await adminOnly("listAudit", listAudit)
    await adminOnly("listUsers", users.listUsers)
    await adminOnly("userCounts", users.userCounts)
    await adminOnly("getPlatformOverview", getPlatformOverview)
    await adminOnly("createUser", async (actor) => {
      fixtureUser = (await users.createUser(actor, newUser)).id
    })
    if (!fixtureUser) throw Error("Fixture user creation failed.")
    const userId = fixtureUser
    await adminOnly("updateUser", (actor) =>
      users.updateUser(actor, { id: userId, name: "Authorization fixture updated", role: "candidate", active: true }),
    )
    await adminOnly("resetPassword", (actor) => users.resetPassword(actor, { id: userId, password }))
    await check("getPreferences", "candidate", "OK", () => workspace.getPreferences(candidate))
    await check("getPreferences", "admin", "OK", () => workspace.getPreferences(admin))
    await check("savePreferences", "fixture candidate", "OK", () =>
      workspace.savePreferences({ id: userId, role: "candidate", name: newUser.name, email: newUser.email }, defaults),
    )
    await check(
      "savePreferences isolation",
      "fixture candidate",
      "OK",
      async () => db.select().from(userPreferences).where(eq(userPreferences.userId, userId)),
      (rows) => rows.length === 1,
    )
    await check("createExam", "candidate", "FORBIDDEN", () => exam.createExam(candidate, settings))
    await check("createExam", "admin", "FORBIDDEN", () => exam.createExam(admin, settings))
    await check("createExam", "owner", "OK", async () => {
      ids.push((await exam.createExam(owner, settings)).id)
    })
    if (ids[1]) await examinerWrite("deleteDraftExam", (actor) => exam.deleteDraftExam(actor, ids[1]))
    await check("listManagedExams", "candidate", "FORBIDDEN", () => exam.listManagedExams(candidate))
    await check(
      "listManagedExams",
      "foreign examiner scope",
      "OK",
      () => exam.listManagedExams(peer),
      (rows) => !rows.some((r) => r.id === id),
    )
    await check(
      "listManagedExams",
      "owner",
      "OK",
      () => exam.listManagedExams(owner),
      (rows) => rows.some((r) => r.id === id),
    )
    await check(
      "listManagedExams",
      "admin",
      "OK",
      () => exam.listManagedExams(admin),
      (rows) => rows.some((r) => r.id === id),
    )
    await examinerRead("getManagedExam", (actor) => exam.getManagedExam(actor, id))
    await examinerWrite("updateExam", (actor) => exam.updateExam(actor, { ...settings, id }))
    await examinerWrite("setExamQuestions", (actor) => exam.setExamQuestions(actor, assignment))
    await examinerRead("getExamQuestions", (actor) => exam.getExamQuestions(actor, id))
    await examinerRead("getReadiness", (actor) => exam.getReadiness(actor, id))
    await examinerWrite("enrollCandidates", (actor) => enrollment.enrollCandidates(actor, studentList))
    await examinerWrite("unenrollCandidate", (actor) => enrollment.unenrollCandidate(actor, id, other.id))
    await examinerRead("listEnrollments", (actor) => enrollment.listEnrollments(actor, id))
    await examinerRead("searchCandidates", (actor) => enrollment.searchCandidates(actor, id, "Ayesha"))
    await check("processImport", "candidate", "FORBIDDEN", () => processImport(candidate, upload, false))
    await check("processImport", "foreign examiner", "NOT_FOUND", () => processImport(peer, upload, false))
    await check("processImport", "owner", "OK", () => processImport(owner, upload, false))
    for (const [name, run] of [
      ["listTopics", bank.listTopics],
      ["listQuestions", bank.listQuestions],
    ] as const) {
      await check<unknown>(name, "candidate", "FORBIDDEN", () => run(candidate))
      await check<unknown>(name, "owner", "OK", () => run(owner))
      await check<unknown>(name, "admin", "OK", () => run(admin))
      await check<unknown>(name, "other examiner", "OK", () => run(peer))
    }
    await check("getQuestion", "candidate", "FORBIDDEN", () => bank.getQuestion(candidate, itemId))
    await check("getQuestion", "foreign examiner", "NOT_FOUND", () => bank.getQuestion(peer, itemId))
    await check("getQuestion", "admin", "OK", () => bank.getQuestion(admin, itemId))
    await check("getQuestion", "owner", "OK", () => bank.getQuestion(owner, itemId))
    const draft = { id: itemId, type: "written" as const, difficulty: "easy" as const, defaultMarks: 2, stem: prefix }
    await examinerWrite("saveQuestion", (actor) => bank.saveQuestion(actor, draft), "FORBIDDEN")
    await check("duplicateQuestion", "candidate", "FORBIDDEN", () => bank.duplicateQuestion(candidate, itemId))
    await check("duplicateQuestion", "foreign examiner", "NOT_FOUND", () => bank.duplicateQuestion(peer, itemId))
    await check("duplicateQuestion", "admin", "NOT_FOUND", () => bank.duplicateQuestion(admin, itemId))
    await check("duplicateQuestion", "owner", "OK", async () => {
      questionIds.push((await bank.duplicateQuestion(owner, itemId)).id)
    })
    if (questionIds[1])
      await examinerWrite("archiveQuestion", (actor) => bank.archiveQuestion(actor, questionIds[1]), "FORBIDDEN")

    await examinerWrite("publishExam", (actor) => exam.publishExam(actor, id))
    await examinerWrite("unpublishExam", (actor) => exam.unpublishExam(actor, id))
    await exam.publishExam(owner, id)
    await check("startAttempt", "wrong role", "FORBIDDEN", () => attempt.startAttempt(owner, id))
    await check("startAttempt", "unenrolled candidate", "NOT_FOUND", () => attempt.startAttempt(outsider, id))
    await check("startAttempt", "enrolled candidate", "OK", () => attempt.startAttempt(candidate, id))
    const { attemptId } = await attempt.startAttempt(candidate, id)
    attemptAuditIds.push(attemptId, `${attemptId}:${itemId}`)
    await enrollment.enrollCandidates(owner, { examId: id, candidateIds: [other.id] })
    const { attemptId: otherAttempt } = await attempt.startAttempt(other, id)
    attemptAuditIds.push(otherAttempt)
    const save = {
      clientId: "authz-fixture",
      answers: [{ itemId, seq: 1, flagged: false, response: { kind: "text" as const, text: "Fixture answer." } }],
    }
    const reason = "Fixture extension " + randomUUID()
    const minimize = (value: unknown) => {
      const json = JSON.stringify(value)
      return (
        !/"(?:answerKey|is_correct|isCorrect)"\s*:|"correct"\s*:\s*(?!null)/.test(json) &&
        ![other.id, otherAttempt, reason].some((token) => json.includes(token))
      )
    }
    async function candidateScope<T>(
      name: string,
      run: (actor: SessionUser) => Promise<T>,
      verify?: (value: T) => boolean,
    ) {
      await check(name, "wrong role", "NOT_FOUND", () => run(owner))
      await check(name, "foreign candidate", "NOT_FOUND", () => run(other))
      await check(name, "attempt owner", "OK", () => run(candidate), verify)
    }
    await check("listCandidateExams", "examiner", "FORBIDDEN", () => attempt.listCandidateExams(owner))
    await check(
      "listCandidateExams",
      "candidate",
      "OK",
      () => attempt.listCandidateExams(candidate),
      (rows) => rows.some((r) => r.id === id),
    )
    await check("getCandidateLobby", "wrong role", "FORBIDDEN", () => attempt.getCandidateLobby(owner, id))
    await check("getCandidateLobby", "unenrolled candidate", "NOT_FOUND", () => attempt.getCandidateLobby(outsider, id))
    await check("getCandidateLobby", "enrolled candidate", "OK", () => attempt.getCandidateLobby(candidate, id))
    await examinerRead("listSandboxAttempts", (actor) => attempt.listSandboxAttempts(actor, id))
    await examinerRead(
      "getExamMonitor",
      (actor) => monitor.getExamMonitor(actor, id),
      (view) => !view.canAct,
    )
    await examinerRead("getAttemptTimeline", (actor) => monitor.getAttemptTimeline(actor, id, attemptId))
    await examinerWrite(
      "postAnnouncement",
      (actor) => monitor.postAnnouncement(actor, id, { body: "Fixture announcement" }),
      "FORBIDDEN",
    )
    await examinerWrite(
      "grantExtension",
      (actor) => monitor.grantExtension(actor, { attemptId, minutes: 1, reason }),
      "FORBIDDEN",
    )
    await candidateScope("getAttemptView", (actor) => attempt.getAttemptView(actor, attemptId), minimize)
    await candidateScope(
      "heartbeat",
      (actor) => attempt.heartbeat(actor, attemptId, { clientId: save.clientId }),
      minimize,
    )
    await candidateScope("saveAnswers", (actor) => attempt.saveAnswers(actor, attemptId, save))
    await candidateScope("saveScratchpad", (actor) => workspace.saveScratchpad(actor, attemptId, "Fixture note."))
    await candidateScope("getAttemptStatus", (actor) => attempt.getAttemptStatus(actor, attemptId))
    await candidateScope("submitAttempt", (actor) => attempt.submitAttempt(actor, attemptId))
    await examinerRead("getResultsOverview", (actor) => grading.getResultsOverview(actor, id))
    await examinerRead("getGradingAttempt", (actor) => grading.getGradingAttempt(actor, id, attemptId))
    await examinerRead("getExamAnalytics", (actor) => getExamAnalytics(actor, id))
    await examinerWrite(
      "gradeAnswer",
      (actor) => grading.gradeAnswer(actor, { attemptId, itemId, marks: 2 }),
      "FORBIDDEN",
    )
    await candidateScope(
      "getCandidateResult before publication",
      (actor) => grading.getCandidateResult(actor, attemptId),
      (value) => !value.published && value.score === null && minimize(value),
    )
    await check("getResultReport before publication", "candidate", "NOT_FOUND", () =>
      getResultReport(candidate, attemptId),
    )
    await examinerWrite("closeExam", (actor) => exam.closeExam(actor, id, attempt.finalizeAllForExam))
    await examinerWrite("publishResults", (actor) => grading.publishResults(actor, id), "FORBIDDEN")
    await candidateScope(
      "getCandidateResult after publication",
      (actor) => grading.getCandidateResult(actor, attemptId),
      (value) => value.published && minimize(value),
    )
    await check("getResultReport", "foreign candidate", "NOT_FOUND", () => getResultReport(other, attemptId))
    await check("getResultReport", "foreign examiner", "NOT_FOUND", () => getResultReport(peer, attemptId))
    await check("getResultReport", "owner examiner", "OK", () => getResultReport(owner, attemptId))
    await check("getResultReport", "admin", "OK", () => getResultReport(admin, attemptId))
    await check("getResultReport", "candidate", "OK", () => getResultReport(candidate, attemptId), minimize)
  } finally {
    await db.transaction(async (tx) => {
      const entities = [...ids, ...questionIds, ...attemptAuditIds, ...(fixtureUser ? [fixtureUser] : [])]
      if (ids.length) await tx.delete(exams).where(inArray(exams.id, ids))
      if (questionIds.length) await tx.delete(questions).where(inArray(questions.id, questionIds))
      if (entities.length)
        await tx
          .delete(auditLog)
          .where(or(inArray(auditLog.entityId, entities), fixtureUser ? eq(auditLog.actorId, fixtureUser) : undefined))
      if (fixtureUser) await tx.delete(user).where(eq(user.id, fixtureUser))
      if (reactivated.length) await tx.update(user).set({ active: false }).where(inArray(user.id, reactivated))
    })
  }
}
main()
  .then(() => {
    console.table(matrix)
    console.log(`${matrix.length - failures}/${matrix.length} passed`)
    process.exit(failures ? 1 : 0)
  })
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "Authorization sweep failed.")
    process.exit(1)
  })
