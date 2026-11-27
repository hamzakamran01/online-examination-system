/**
 * Failure resilience (I-5.3) and trust and dispute resolution (I-5.4) checks against the test branch.
 * Run: pnpm verify:trust   (uses .env.test; refuses the demo database)
 * Self-contained: creates its own exam, runs every check, then deletes the exam (cascade).
 *
 * Covers: gap cause classification (background tab vs offline vs no contact), device switch with
 * resume, declared incidents (per-candidate measured compensation, idempotency, no double pay,
 * authz), disputes (window, duplicates, authz, regrade, void for everyone, report replacement,
 * data minimization).
 */
import { randomUUID } from "node:crypto"
import { and, count, eq, isNull, sql } from "drizzle-orm"
import { ZodError } from "zod"
import { db } from "@/server/db/client"
import {
  attemptEvents,
  attempts,
  auditLog,
  disputes,
  enrollments,
  examIncidents,
  examQuestions,
  exams,
  questions,
  resultReports,
  timeExtensions,
  user,
} from "@/server/db/schema"
import type { SessionUser } from "@/server/auth/guards"
import { getAttemptView, heartbeat, saveAnswers, startAttempt, submitAttempt } from "@/server/services/attempts"
import { declareIncident, getAttemptTimeline, getExamMonitor, previewIncident } from "@/server/services/monitoring"
import { getCandidateResult, getGradingAttempt, gradeAnswer, publishResults } from "@/server/services/grading"
import { getCandidateDisputes, getDisputeEvidence, listExamDisputes, raiseDispute, resolveDispute, withdrawDispute } from "@/server/services/disputes"
import { getResultReport } from "@/server/services/reports"

let failures = 0
let passes = 0
const check = (label: string, ok: boolean, detail = "") => {
  if (ok) passes++
  else failures++
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? `  (${detail})` : ""}`)
}
async function expectError(label: string, fn: () => Promise<unknown>, code: string) {
  try {
    await fn()
    check(label, false, "no error thrown")
  } catch (e) {
    const got = e instanceof ZodError ? "VALIDATION" : (e as { code?: string }).code
    check(label, got === code, `got ${got}${got !== code ? `: ${(e as Error).message}` : ""}`)
  }
}
const asUser = async (email: string): Promise<SessionUser> => {
  const [u] = await db.select().from(user).where(eq(user.email, email))
  if (!u) throw new Error(`Seed user ${email} missing`)
  return { id: u.id, name: u.name, email: u.email, role: u.role }
}
const backdateLastSeen = (attemptId: string, ms: number) =>
  db.update(attempts).set({ lastSeenAt: new Date(Date.now() - ms) }).where(eq(attempts.id, attemptId))
const lastGap = async (examId: string, actor: SessionUser, attemptId: string) => {
  const t = await getAttemptTimeline(actor, examId, attemptId)
  const gaps = t.events.filter((e) => e.type === "connection_gap")
  return gaps[gaps.length - 1]?.detail as { gapSec?: number; cause?: string; hiddenSec?: number } | undefined
}
const deadlineOf = async (id: string) => (await db.select({ d: attempts.deadlineAt }).from(attempts).where(eq(attempts.id, id)))[0].d.getTime()

async function main() {
  const url = process.env.DATABASE_URL ?? ""
  if (!url.includes("ep-") || url.includes("ep-old-flower")) throw new Error("Refusing to run: an isolated test database is required.")
  const examiner = await asUser("examiner@examvault.test")
  const examiner2 = await asUser("examiner2@examvault.test")
  const admin = await asUser("admin@examvault.test")
  const ayesha = await asUser("ayesha@examvault.test")
  const bilal = await asUser("bilal@examvault.test")
  const sara = await asUser("sara@examvault.test")

  const pick = async (type: "single" | "written") => {
    const [q] = await db
      .select({ id: questions.id })
      .from(questions)
      .where(and(eq(questions.ownerId, examiner.id), eq(questions.type, type), isNull(questions.archivedAt)))
      .limit(1)
    if (!q) throw new Error(`Examiner has no ${type} question in the test branch`)
    return q.id
  }
  const singleId = await pick("single")
  const writtenId = await pick("written")

  const now = Date.now()
  const [exam] = await db
    .insert(exams)
    .values({
      ownerId: examiner.id,
      title: `Trust check ${new Date(now).toISOString()}`,
      startsAt: new Date(now - 20 * 60_000),
      endsAt: new Date(now + 3_600_000),
      durationMin: 45,
      totalMarks: 5,
      status: "published",
      publishedAt: new Date(now - 20 * 60_000),
      shuffleQuestions: false,
      shuffleOptions: false,
    })
    .returning()
  await db.insert(examQuestions).values([
    { examId: exam.id, questionId: singleId, position: 0, marks: 2 },
    { examId: exam.id, questionId: writtenId, position: 1, marks: 3 },
  ])
  await db.insert(enrollments).values([ayesha, bilal, sara].map((c) => ({ examId: exam.id, candidateId: c.id, enrolledBy: examiner.id })))

  try {
    const A = (await startAttempt(ayesha, exam.id)).attemptId
    const B = (await startAttempt(bilal, exam.id)).attemptId
    const S = (await startAttempt(sara, exam.id)).attemptId
    // Attempts started 15 minutes ago, so incident windows fall inside the exam.
    await db.update(attempts).set({ startedAt: new Date(now - 15 * 60_000) }).where(eq(attempts.examId, exam.id))
    const [paper] = await db.select({ paper: attempts.paper }).from(attempts).where(eq(attempts.id, A))
    const single = paper.paper.items.find((i) => i.type === "single")!
    const written = paper.paper.items.find((i) => i.type === "written")!

    console.log("\n# I-5.3 gap causes: a hidden tab is not an outage")
    await heartbeat(ayesha, A, { clientId: "device-A-0001" })
    await backdateLastSeen(A, 90_000)
    await heartbeat(ayesha, A, { clientId: "device-A-0001", presence: { hiddenMs: 88_000, offlineMs: 0, visible: true } })
    let g = await lastGap(exam.id, examiner, A)
    check("silence while the tab was hidden is labelled background_tab", g?.cause === "background_tab", JSON.stringify(g))
    let m = await getExamMonitor(examiner, exam.id)
    let rowA = m.rows.find((r) => r.attemptId === A)!
    check("background silence is not counted as an outage", rowA.gapSec === 0 && rowA.backgroundSec >= 89, `gap ${rowA.gapSec}, background ${rowA.backgroundSec}`)

    await backdateLastSeen(A, 120_000)
    await heartbeat(ayesha, A, { clientId: "device-A-0001", presence: { hiddenMs: 0, offlineMs: 110_000, visible: true } })
    g = await lastGap(exam.id, examiner, A)
    check("device reported offline: labelled device_offline", g?.cause === "device_offline")

    await backdateLastSeen(A, 70_000)
    await heartbeat(ayesha, A, { clientId: "device-A-0001", presence: { hiddenMs: 0, offlineMs: 0, visible: true } })
    g = await lastGap(exam.id, examiner, A)
    check("visible and online, yet silent: labelled no_contact (server or network path)", g?.cause === "no_contact")

    await backdateLastSeen(A, 80_000)
    await saveAnswers(ayesha, A, {
      clientId: "device-A-0001",
      answers: [{ itemId: single.itemId, response: { kind: "choice", selected: [single.options[0].id] }, flagged: true, seq: 1 }],
      presence: { hiddenMs: 79_000, offlineMs: 0, visible: true },
    })
    g = await lastGap(exam.id, examiner, A)
    check("autosaves carry the ledger too: background_tab on a save", g?.cause === "background_tab")
    m = await getExamMonitor(examiner, exam.id)
    rowA = m.rows.find((r) => r.attemptId === A)!
    check("monitor outage total counts only real outages (offline + no contact)", rowA.gapSec >= 185 && rowA.gapSec <= 195, `${rowA.gapSec} s`)

    console.log("\n# I-5.3 device switch: answers, time left and a device_change event")
    const deadlineBefore = await deadlineOf(A)
    await backdateLastSeen(A, 60_000)
    // The new device claims a hidden tab: a ledger from a different device cannot describe the silence.
    await heartbeat(ayesha, A, { clientId: "device-B-0002", presence: { hiddenMs: 59_000, offlineMs: 0, visible: true } })
    g = await lastGap(exam.id, examiner, A)
    check("ledger from a different device is ignored (cause no_contact)", g?.cause === "no_contact")
    const [{ n: dc }] = await db.select({ n: count() }).from(attemptEvents).where(and(eq(attemptEvents.attemptId, A), eq(attemptEvents.type, "device_change")))
    check("server recorded a device_change event", dc === 1)
    const view = await getAttemptView(ayesha, A)
    const resumed = view.answers[single.itemId]
    check(
      "resume on the new device: saved answer and flag restored from the server",
      resumed?.response?.kind === "choice" && resumed.response.selected[0] === single.options[0].id && resumed.flagged === true
    )
    check("resume keeps the same server deadline", Date.parse(view.deadlineAt) === deadlineBefore)
    check("resume view never carries the answer key", !/answerKey|isCorrect|"correct"/.test(JSON.stringify(view)))

    console.log("\n# I-5.3 declared incident: each affected candidate gets their own measured loss")
    // The gaps above were measured seconds ago. Move them 30 minutes back so this window starts clean.
    await db.execute(
      sql`update attempt_events set detail = detail
            || jsonb_build_object('from', to_char((detail->>'from')::timestamptz - interval '30 minutes', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
            || jsonb_build_object('to', to_char((detail->>'to')::timestamptz - interval '30 minutes', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
          where attempt_id = ${A} and type = 'connection_gap'`
    )
    // Ayesha: a measured 5 minute gap inside the window. Bilal: still out for 4 minutes. Sara: connected.
    await heartbeat(ayesha, A, { clientId: "device-B-0002" })
    await backdateLastSeen(A, 300_000)
    await heartbeat(ayesha, A, { clientId: "device-B-0002", presence: { hiddenMs: 0, offlineMs: 0, visible: true } })
    await heartbeat(bilal, B, { clientId: "device-C-0003" })
    await backdateLastSeen(B, 240_000)
    await heartbeat(sara, S, { clientId: "device-D-0004" })
    const window = { from: new Date(Date.now() - 6 * 60_000).toISOString(), to: new Date().toISOString() }

    await expectError("other examiner cannot preview an incident", () => previewIncident(examiner2, exam.id, window), "NOT_FOUND")
    await expectError("candidate cannot preview an incident", () => previewIncident(ayesha, exam.id, window), "NOT_FOUND")
    const adminPlan = await previewIncident(admin, exam.id, window)
    check("admin can preview (read only)", adminPlan.rows.length === 3)
    await expectError("admin cannot declare an incident", () => declareIncident(admin, exam.id, { ...window, reason: "Network outage in lab 2", requestKey: randomUUID() }), "FORBIDDEN")
    await expectError(
      "a window ending in the future is rejected",
      () => previewIncident(examiner, exam.id, { from: window.from, to: new Date(Date.now() + 3_600_000).toISOString() }),
      "VALIDATION"
    )

    const plan = await previewIncident(examiner, exam.id, window)
    const pa = plan.rows.find((r) => r.attemptId === A)!
    const pb = plan.rows.find((r) => r.attemptId === B)!
    const ps = plan.rows.find((r) => r.attemptId === S)!
    check("Ayesha: 5 measured minutes become 5 minutes", pa.status === "eligible" && pa.seconds === 300, `${pa.outageSec} s -> ${pa.seconds} s`)
    check("Bilal: still out, measured so far, rounded up", pb.status === "eligible" && pb.stillOut && pb.seconds === 300, `${pb.outageSec} s -> ${pb.seconds} s`)
    check("Sara stayed connected: nothing", ps.status === "no_outage" && ps.seconds === 0)

    const dA = await deadlineOf(A)
    const dB = await deadlineOf(B)
    const dS = await deadlineOf(S)
    const key = randomUUID()
    const res = await declareIncident(examiner, exam.id, { ...window, reason: "Campus network outage in lab 2", requestKey: key })
    check("grant applied to exactly the affected candidates", res.affected === 2 && res.totalSec === 600, JSON.stringify(res))
    check("Ayesha's deadline moved by her own amount", (await deadlineOf(A)) - dA === 300_000)
    check("Bilal's deadline moved by his own amount", (await deadlineOf(B)) - dB === 300_000)
    check("Sara's deadline unchanged", (await deadlineOf(S)) === dS)
    const exts = await db.select().from(timeExtensions).where(eq(timeExtensions.incidentId, res.incidentId))
    check("every grant is linked to the incident with the shared reason", exts.length === 2 && exts.every((x) => x.reason === "Campus network outage in lab 2"))
    const [audited] = await db.select({ n: count() }).from(auditLog).where(and(eq(auditLog.action, "exam.incident_declared"), eq(auditLog.entityId, exam.id)))
    check("incident is in the audit log", audited.n === 1)

    const again = await declareIncident(examiner, exam.id, { ...window, reason: "Campus network outage in lab 2", requestKey: key })
    check("repeating the same request (double click, retry) applies once", again.duplicate === true && (await deadlineOf(A)) - dA === 300_000)
    await expectError(
      "declaring the same outage again cannot pay twice",
      () => declareIncident(examiner, exam.id, { ...window, reason: "Same outage declared twice", requestKey: randomUUID() }),
      "CONFLICT"
    )
    const [{ n: incidents }] = await db.select({ n: count() }).from(examIncidents).where(eq(examIncidents.examId, exam.id))
    check("exactly one incident row", incidents === 1)
    const hbA = await heartbeat(ayesha, A, { clientId: "device-B-0002" })
    check("candidate sees the extra time on the next heartbeat, without the reason", hbA.extensions.length === 1 && !JSON.stringify(hbA).includes("lab 2"))

    console.log("\n# I-5.4 disputes")
    await saveAnswers(bilal, B, {
      clientId: "device-C-0003",
      answers: [
        { itemId: single.itemId, response: { kind: "choice", selected: [single.options[1].id] }, flagged: false, seq: 1 },
        { itemId: written.itemId, response: { kind: "text", text: "A partial unique index on exam and candidate." }, flagged: false, seq: 2 },
      ],
    })
    await saveAnswers(sara, S, {
      clientId: "device-D-0004",
      answers: [{ itemId: written.itemId, response: { kind: "text", text: "Use a unique constraint on (exam_id, candidate_id)." }, flagged: false, seq: 1 }],
    })
    for (const [c, id] of [[ayesha, A], [bilal, B], [sara, S]] as const) await submitAttempt(c, id)
    await gradeAnswer(examiner, { attemptId: B, itemId: written.itemId, marks: 2, feedback: "", reason: "" })
    await gradeAnswer(examiner, { attemptId: S, itemId: written.itemId, marks: 1, feedback: "Missing the constraint name.", reason: "" })

    const grading = await getGradingAttempt(examiner, exam.id, A)
    check("grader sees the attempt evidence (outages, extra time, device change)", grading.evidence.outageSec > 0 && grading.evidence.extensions.length === 1 && grading.evidence.deviceChanges === 1, grading.evidence.summary)

    await expectError("no disputes before results are published", () => raiseDispute(sara, { attemptId: S, itemId: written.itemId, type: "grading_error", statement: "My answer names the constraint clearly." }), "NOT_FOUND")
    await db.update(exams).set({ endsAt: new Date(Date.now() - 1000), startsAt: new Date(Date.now() - 3_600_000), status: "completed", closedAt: new Date() }).where(eq(exams.id, exam.id))
    await publishResults(examiner, exam.id)

    const reportBefore = await getResultReport(sara, S)
    const statement = "The question says 'name the constraint' and my answer names it: a unique constraint on exam and candidate."
    await expectError("statement too short is rejected", () => raiseDispute(sara, { attemptId: S, itemId: written.itemId, type: "grading_error", statement: "too short" }), "VALIDATION")
    await expectError("cannot dispute another candidate's attempt", () => raiseDispute(bilal, { attemptId: S, itemId: written.itemId, type: "grading_error", statement }), "NOT_FOUND")
    await expectError("examiner cannot raise a dispute", () => raiseDispute(examiner, { attemptId: S, itemId: written.itemId, type: "grading_error", statement }), "FORBIDDEN")
    const dS1 = await raiseDispute(sara, { attemptId: S, itemId: written.itemId, type: "grading_error", statement })
    const dS2 = await raiseDispute(sara, { attemptId: S, itemId: written.itemId, type: "grading_error", statement })
    check("raising the same dispute twice returns the first one", dS2.duplicate && dS2.id === dS1.id)
    const amb = "Options A and B are both defensible readings of the wording in this question."
    const dA1 = await raiseDispute(ayesha, { attemptId: A, itemId: single.itemId, type: "ambiguous_question", statement: amb })
    const dB1 = await raiseDispute(bilal, { attemptId: B, itemId: single.itemId, type: "ambiguous_question", statement: amb })

    const list = await listExamDisputes(examiner, exam.id)
    const hot = list.questions.find((q) => q.itemId === single.itemId)
    check("question with two disputes is flagged as a hotspot", !!hot?.hotspot && hot.total === 2)
    await expectError("other examiner cannot list disputes", () => listExamDisputes(examiner2, exam.id), "NOT_FOUND")
    await expectError("candidate cannot open an evidence pack", () => getDisputeEvidence(sara, exam.id, dS1.id), "NOT_FOUND")
    const pack = await getDisputeEvidence(examiner, exam.id, dS1.id)
    check("evidence pack: frozen question, answer, rubric, history, cohort", pack.question.item.itemId === written.itemId && !!pack.question.rubric && pack.history.length >= 1 && pack.cohort.candidates === 3)
    const adminPack = await getDisputeEvidence(admin, exam.id, dS1.id)
    check("admin can read the evidence pack but not decide", adminPack.canAct === false)

    const mine = await getCandidateDisputes(sara, S)
    check("candidate dispute list never carries keys, rubric or other candidates", !/answerKey|rubric|isCorrect|ayesha|bilal/i.test(JSON.stringify(mine)))
    await expectError("candidate cannot withdraw someone else's dispute", () => withdrawDispute(bilal, { disputeId: dS1.id }), "NOT_FOUND")
    await expectError("other examiner cannot resolve", () => resolveDispute(examiner2, { disputeId: dS1.id, outcome: "reject", note: "Not my exam to decide." }), "NOT_FOUND")
    await expectError("candidate cannot resolve", () => resolveDispute(sara, { disputeId: dS1.id, outcome: "reject", note: "I decide my own dispute." }), "FORBIDDEN")
    await expectError("regrade above the maximum is rejected", () => resolveDispute(examiner, { disputeId: dS1.id, outcome: "regrade", marks: 9, note: "Too generous on purpose." }), "VALIDATION")

    const rg = await resolveDispute(examiner, { disputeId: dS1.id, outcome: "regrade", marks: 3, note: "Agreed: the constraint is named, full marks under rubric point 2." })
    check("regrade recalculates the total", rg.outcome === "regrade" && rg.newTotal === 3, JSON.stringify(rg))
    const [oldReport] = await db.select().from(resultReports).where(eq(resultReports.code, reportBefore.code))
    check("the previously issued report code now shows Replaced", !!oldReport.revokedAt && rg.reportsReplaced === 1)
    const reportAfter = await getResultReport(sara, S)
    check("a new report carries the new score", reportAfter.code !== reportBefore.code && reportAfter.score === 3)
    await expectError("a decided dispute cannot be decided again", () => resolveDispute(examiner, { disputeId: dS1.id, outcome: "reject", note: "Changed my mind later." }), "CONFLICT")
    const saraView = await getCandidateDisputes(sara, S)
    check("candidate timeline shows the decision, the reason and the mark change", saraView.disputes[0].status === "regraded" && saraView.disputes[0].marksBefore === 1 && saraView.disputes[0].marksAfter === 3 && !!saraView.disputes[0].resolutionNote)

    const ayeshaSingle = (await getCandidateResult(ayesha, A)).items.find((i) => i.itemId === single.itemId)?.marks ?? 0
    const [beforeVoid] = await db.select({ max: attempts.maxMarks, total: attempts.scoreTotal }).from(attempts).where(eq(attempts.id, A))
    const vd = await resolveDispute(examiner, { disputeId: dA1.id, outcome: "void", policy: "exclude", note: "The wording allows two readings. Removed from every paper." })
    check("void applies to every paper with the question", vd.outcome === "void" && vd.affected === 3 && vd.alsoClosed === 1, JSON.stringify(vd))
    const all = await db.select({ id: attempts.id, max: attempts.maxMarks, total: attempts.scoreTotal }).from(attempts).where(eq(attempts.examId, exam.id))
    check("every paper's maximum shrank by the voided marks (one rule for all)", all.every((a) => a.max === 3), all.map((a) => a.max).join(","))
    const [afterVoid] = all.filter((a) => a.id === A)
    check("Ayesha's total dropped the voided question's marks", beforeVoid.max === 5 && afterVoid.total === (beforeVoid.total ?? 0) - ayeshaSingle, `${beforeVoid.total} - ${ayeshaSingle} = ${afterVoid.total}`)
    const [bilalDispute] = await db.select().from(disputes).where(eq(disputes.id, dB1.id))
    check("Bilal's open dispute on the same question closed with the same decision", bilalDispute.status === "voided")
    const ayeshaResult = await getCandidateResult(ayesha, A)
    check("candidate result marks the question as voided", ayeshaResult.items.find((i) => i.itemId === single.itemId)?.voided === "exclude")
    await expectError("cannot dispute a voided question", () => raiseDispute(sara, { attemptId: S, itemId: single.itemId, type: "ambiguous_question", statement: amb }), "CONFLICT")
    await expectError("a dispute closed by the void cannot be decided again", () => resolveDispute(examiner, { disputeId: dB1.id, outcome: "reject", note: "Already decided by the void." }), "CONFLICT")

    await db.update(exams).set({ resultsPublishedAt: new Date(Date.now() - 8 * 24 * 3_600_000) }).where(eq(exams.id, exam.id))
    await expectError("after the dispute window closes, new disputes are refused", () => raiseDispute(bilal, { attemptId: B, itemId: written.itemId, type: "grading_error", statement }), "CONFLICT")
    const [{ n: disputeAudits }] = await db.select({ n: count() }).from(auditLog).where(and(eq(auditLog.entityType, "dispute"), eq(auditLog.action, "dispute.resolved")))
    check("every decision is audited", disputeAudits >= 2)
  } finally {
    await db.delete(exams).where(eq(exams.id, exam.id))
  }
  console.log(`\n${passes} passed, ${failures} failed`)
  process.exit(failures ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
