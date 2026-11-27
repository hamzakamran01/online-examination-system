/**
 * Monitoring and resilience integrity checks (C-3.6.1 to C-3.6.3, I-5.3) against the test branch.
 * Run: pnpm verify:monitoring   (uses .env.test; never the demo database)
 * Self-contained: creates its own exam, runs every check, then deletes the exam (cascade).
 */
import { and, count, eq, isNull } from "drizzle-orm"
import { ZodError } from "zod"
import { db } from "@/server/db/client"
import { attemptEvents, attempts, enrollments, examQuestions, exams, questions, user } from "@/server/db/schema"
import type { SessionUser } from "@/server/auth/guards"
import { heartbeat, saveAnswers, startAttempt, submitAttempt } from "@/server/services/attempts"
import { getAttemptTimeline, getExamMonitor, grantExtension, postAnnouncement } from "@/server/services/monitoring"
import { CLIENT_SIGNAL_CAP, EXTENSION_CAP_SEC } from "@/lib/domain/monitoring"

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
    const got = e instanceof ZodError ? "VALIDATION" : (e as { code?: string }).code
    check(label, got === code, `got ${got}`)
  }
}
const asUser = async (email: string): Promise<SessionUser> => {
  const [u] = await db.select().from(user).where(eq(user.email, email))
  if (!u) throw new Error(`Seed user ${email} missing`)
  return { id: u.id, name: u.name, email: u.email, role: u.role }
}
const backdateLastSeen = (attemptId: string, ms: number) =>
  db.update(attempts).set({ lastSeenAt: new Date(Date.now() - ms) }).where(eq(attempts.id, attemptId))
const eventCount = async (attemptId: string, type?: string) => {
  const [r] = await db
    .select({ n: count() })
    .from(attemptEvents)
    .where(type ? and(eq(attemptEvents.attemptId, attemptId), eq(attemptEvents.type, type as never)) : eq(attemptEvents.attemptId, attemptId))
  return r.n
}

async function main() {
  if (!process.env.DATABASE_URL?.includes("ep-")) throw new Error("DATABASE_URL missing")
  const examiner = await asUser("examiner@examvault.test")
  const examiner2 = await asUser("examiner2@examvault.test")
  const admin = await asUser("admin@examvault.test")
  const ayesha = await asUser("ayesha@examvault.test")
  const bilal = await asUser("bilal@examvault.test")

  const [q] = await db
    .select({ id: questions.id })
    .from(questions)
    .where(and(eq(questions.ownerId, examiner.id), eq(questions.type, "single"), isNull(questions.archivedAt)))
    .limit(1)
  if (!q) throw new Error("Examiner has no single-choice question in the test branch")

  const now = Date.now()
  const [exam] = await db
    .insert(exams)
    .values({
      ownerId: examiner.id,
      title: `Monitor check ${new Date(now).toISOString()}`,
      startsAt: new Date(now - 60_000),
      endsAt: new Date(now + 3_600_000),
      durationMin: 30,
      totalMarks: 1,
      status: "published",
      publishedAt: new Date(now),
      shuffleQuestions: false,
      shuffleOptions: false,
    })
    .returning()
  await db.insert(examQuestions).values({ examId: exam.id, questionId: q.id, position: 0, marks: 1 })
  await db.insert(enrollments).values([
    { examId: exam.id, candidateId: ayesha.id, enrolledBy: examiner.id },
    { examId: exam.id, candidateId: bilal.id, enrolledBy: examiner.id },
  ])

  try {
    // ---------- Access control (invariant 5; foreign ids are 404) ----------
    await expectError("other examiner cannot open the monitor", () => getExamMonitor(examiner2, exam.id), "NOT_FOUND")
    await expectError("candidate cannot open the monitor", () => getExamMonitor(ayesha, exam.id), "NOT_FOUND")
    const adminView = await getExamMonitor(admin, exam.id)
    check("admin can read the monitor but not act", adminView.canAct === false && adminView.rows.length === 2)

    let m = await getExamMonitor(examiner, exam.id)
    check("owner can act", m.canAct)
    check("before start: both not started", m.summary.not_started === 2 && m.summary.writing === 0)

    // ---------- Live state ----------
    const { attemptId } = await startAttempt(ayesha, exam.id)
    const [att] = await db.select().from(attempts).where(eq(attempts.id, attemptId))
    const item = att.paper.items[0]
    m = await getExamMonitor(examiner, exam.id)
    const row = () => m.rows.find((r) => r.candidateId === ayesha.id)!
    check("after start: writing, 0 answered", row().state === "writing" && row().answered === 0 && row().total === 1)

    await saveAnswers(ayesha, attemptId, { clientId: "device-A-0001", answers: [{ itemId: item.itemId, response: { kind: "choice", selected: [item.options[0].id] }, flagged: false, seq: 1 }] })
    m = await getExamMonitor(examiner, exam.id)
    check("answered count follows saves", row().answered === 1)

    await backdateLastSeen(attemptId, 40_000)
    m = await getExamMonitor(examiner, exam.id)
    check("no contact for 40 s: disconnected", row().state === "disconnected" && m.summary.disconnected === 1)

    // ---------- Heartbeat and measured gaps ----------
    await expectError("other candidate cannot heartbeat this attempt", () => heartbeat(bilal, attemptId, { clientId: "device-B-0001" }), "NOT_FOUND")
    await expectError("examiner cannot heartbeat a candidate attempt", () => heartbeat(examiner, attemptId, { clientId: "device-B-0001" }), "NOT_FOUND")
    await backdateLastSeen(attemptId, 125_000)
    const hb = await heartbeat(ayesha, attemptId, { clientId: "device-A-0001" })
    check("heartbeat returns server time and deadline", hb.status === "in_progress" && Date.parse(hb.deadlineAt) > Date.now())
    const timeline = await getAttemptTimeline(examiner, exam.id, attemptId)
    const gap = timeline.events.find((e) => e.type === "connection_gap")
    const gapSec = (gap?.detail as { gapSec?: number } | undefined)?.gapSec ?? 0
    check("server measured the outage as a connection gap", !!gap && gap.source === "server" && gapSec >= 124 && gapSec <= 127, `${gapSec} s`)
    m = await getExamMonitor(examiner, exam.id)
    check("back to writing after the heartbeat", row().state === "writing" && row().gapSec === gapSec)
    await heartbeat(ayesha, attemptId, { clientId: "device-A-0001" })
    check("a normal heartbeat records no extra gap", (await eventCount(attemptId, "connection_gap")) === 1)

    // ---------- Signals ----------
    await heartbeat(ayesha, attemptId, {
      clientId: "device-A-0001",
      signals: [
        { type: "tab_hidden", durationMs: 400 },
        { type: "tab_hidden", durationMs: 4200, at: Date.now() },
        { type: "fullscreen_exit" },
      ],
    })
    check("tab switch under 1 s ignored, others stored", (await eventCount(attemptId, "tab_hidden")) === 1 && (await eventCount(attemptId, "fullscreen_exit")) === 1)
    await expectError("client cannot report server-only events", () => heartbeat(ayesha, attemptId, { clientId: "device-A-0001", signals: [{ type: "connection_gap" as never }] }), "VALIDATION")

    await heartbeat(ayesha, attemptId, { clientId: "device-B-0002" })
    await heartbeat(ayesha, attemptId, { clientId: "device-A-0001" })
    check("device change recorded once (repeats collapsed)", (await eventCount(attemptId, "device_change")) === 1)

    for (let i = 0; i < 5; i++)
      await heartbeat(ayesha, attemptId, { clientId: "device-A-0001", signals: Array.from({ length: 50 }, () => ({ type: "fullscreen_exit" as const })) })
    const [client] = await db.select({ n: count() }).from(attemptEvents).where(and(eq(attemptEvents.attemptId, attemptId), eq(attemptEvents.source, "client")))
    check(`client signals capped at ${CLIENT_SIGNAL_CAP}`, client.n === CLIENT_SIGNAL_CAP, `${client.n}`)
    const afterFlood = await heartbeat(ayesha, attemptId, { clientId: "device-A-0001" })
    check("signals never end the attempt", afterFlood.status === "in_progress")

    // ---------- Announcements ----------
    await expectError("candidate cannot announce", () => postAnnouncement(ayesha, exam.id, { body: "Hello everyone" }), "FORBIDDEN")
    await expectError("other examiner cannot announce", () => postAnnouncement(examiner2, exam.id, { body: "Hello everyone" }), "NOT_FOUND")
    await expectError("empty announcement rejected", () => postAnnouncement(examiner, exam.id, { body: "  " }), "VALIDATION")
    const first = await postAnnouncement(examiner, exam.id, { body: "Question 1: read metres, not km." })
    const again = await postAnnouncement(examiner, exam.id, { body: "Question 1: read metres, not km." })
    check("double post returns the first announcement", again.duplicate && again.id === first.id)
    const hbAnn = await heartbeat(ayesha, attemptId, { clientId: "device-A-0001" })
    check("candidate receives it on the next heartbeat", hbAnn.announcements.length === 1 && hbAnn.announcements[0].id === first.id)

    // ---------- Extensions ----------
    await expectError("candidate cannot grant time", () => grantExtension(ayesha, { attemptId, minutes: 5, reason: "Power cut at home" }), "FORBIDDEN")
    await expectError("other examiner cannot grant time", () => grantExtension(examiner2, { attemptId, minutes: 5, reason: "Power cut at home" }), "NOT_FOUND")
    await expectError("admin cannot grant time (read only)", () => grantExtension(admin, { attemptId, minutes: 5, reason: "Power cut at home" }), "FORBIDDEN")
    await expectError("reason is required", () => grantExtension(examiner, { attemptId, minutes: 5, reason: "" }), "VALIDATION")
    const [beforeExt] = await db.select({ d: attempts.deadlineAt }).from(attempts).where(eq(attempts.id, attemptId))
    const g1 = await grantExtension(examiner, { attemptId, minutes: 5, reason: "Connection outage measured by server" })
    check("deadline moves by exactly 5 minutes", Date.parse(g1.deadlineAt) - beforeExt.d.getTime() === 300_000 && g1.extensionSec === 300)
    const hbExt = await heartbeat(ayesha, attemptId, { clientId: "device-A-0001" })
    check("candidate heartbeat carries the new deadline", hbExt.deadlineAt === g1.deadlineAt && hbExt.extensions.length === 1)
    check("candidate never sees the examiner's reason", !JSON.stringify(hbExt).includes("Connection outage measured"))
    await expectError("cap enforced (5 + 11 > 15)", () => grantExtension(examiner, { attemptId, minutes: 11, reason: "Second outage today" }), "VALIDATION")
    const results = await Promise.allSettled([
      grantExtension(examiner, { attemptId, minutes: 10, reason: "Concurrent grant one" }),
      grantExtension(examiner, { attemptId, minutes: 10, reason: "Concurrent grant two" }),
    ])
    check("concurrent grants cannot exceed the cap (row lock)", results.filter((r) => r.status === "fulfilled").length === 1)
    const [afterExt] = await db.select({ s: attempts.extensionSec }).from(attempts).where(eq(attempts.id, attemptId))
    check(`total extension stays at the ${EXTENSION_CAP_SEC / 60} min cap`, afterExt.s === EXTENSION_CAP_SEC, `${afterExt.s} s`)
    check("each grant is on the timeline", (await eventCount(attemptId, "extension_granted")) === 2)

    // ---------- Timeline access ----------
    await expectError("other examiner cannot read the timeline", () => getAttemptTimeline(examiner2, exam.id, attemptId), "NOT_FOUND")
    const otherExam = await db.select({ id: exams.id }).from(exams).where(eq(exams.ownerId, examiner2.id)).limit(1)
    if (otherExam[0]) await expectError("attempt id under a foreign exam id is 404", () => getAttemptTimeline(examiner2, otherExam[0].id, attemptId), "NOT_FOUND")

    // ---------- After submission ----------
    await submitAttempt(ayesha, attemptId)
    await expectError("no extension after submission", () => grantExtension(examiner, { attemptId, minutes: 1, reason: "Too late now" }), "CONFLICT")
    const hbDone = await heartbeat(ayesha, attemptId, { clientId: "device-A-0001", signals: [{ type: "fullscreen_exit" }] })
    check("heartbeat after submit reports the final state", hbDone.status === "submitted")
    m = await getExamMonitor(examiner, exam.id)
    check("monitor shows submitted", row().state === "submitted" && m.summary.submitted === 1 && m.summary.not_started === 1)

    // ---------- Sandbox exclusion (invariant 6) ----------
    await startAttempt(examiner, exam.id, { sandbox: true })
    m = await getExamMonitor(examiner, exam.id)
    check("sandbox attempts never appear on the monitor", m.rows.length === 2 && m.rows.every((r) => r.candidateId !== examiner.id))
  } finally {
    await db.delete(exams).where(eq(exams.id, exam.id))
  }

  console.log(failures ? `\n${failures} check(s) failed` : "\nAll monitoring checks passed")
  process.exit(failures ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
