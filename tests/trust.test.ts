import { test } from "node:test"
import assert from "node:assert/strict"
import { EXTENSION_CAP_SEC, GAP_THRESHOLD_MS, classifyGap } from "../src/lib/domain/monitoring"
import { outageInWindow, overlapMs, planCompensation } from "../src/lib/domain/incidents"
import { attemptTotals, itemOutcome } from "../src/lib/domain/scoring"
import { DISPUTE_WINDOW_MS, disputeWindow, isHotspot } from "../src/lib/domain/disputes"
import { declareIncidentSchema, heartbeatSchema } from "../src/lib/validation/monitoring"
import { raiseDisputeSchema, resolveDisputeSchema } from "../src/lib/validation/disputes"

/* ---------- I-5.3 gap causes ---------- */
test("gap cause: hidden for the whole silence is a background tab, not an outage", () => {
  assert.equal(classifyGap(90_000, { hiddenMs: 88_000, offlineMs: 0 }), "background_tab")
})
test("gap cause: visible for longer than one threshold is not explained by throttling", () => {
  assert.equal(classifyGap(120_000, { hiddenMs: 120_000 - GAP_THRESHOLD_MS - 1, offlineMs: 0 }), "no_contact")
})
test("gap cause: a real loss of network wins over a hidden tab", () => {
  assert.equal(classifyGap(120_000, { hiddenMs: 120_000, offlineMs: 100_000 }), "device_offline")
})
test("gap cause: no ledger (old client, other device) is treated as no contact", () => {
  assert.equal(classifyGap(120_000, undefined), "no_contact")
})
test("gap cause: ledger values longer than the gap are clamped, never inflate", () => {
  assert.equal(classifyGap(60_000, { hiddenMs: 10 * 3_600_000, offlineMs: 0 }), "background_tab")
})
test("heartbeat accepts an optional presence ledger and bounds it", () => {
  assert.ok(heartbeatSchema.safeParse({ clientId: "device-A-0001", presence: { hiddenMs: 1, offlineMs: 0, visible: true } }).success)
  assert.ok(!heartbeatSchema.safeParse({ clientId: "device-A-0001", presence: { hiddenMs: -1, offlineMs: 0, visible: true } }).success)
  assert.ok(!heartbeatSchema.safeParse({ clientId: "device-A-0001", presence: { hiddenMs: 25 * 3_600_000, offlineMs: 0, visible: true } }).success)
})

/* ---------- I-5.3 incidents ---------- */
const T = 1_000_000_000_000
test("overlap of two intervals", () => {
  assert.equal(overlapMs(0, 10, 5, 20), 5)
  assert.equal(overlapMs(0, 10, 10, 20), 0)
  assert.equal(overlapMs(5, 6, 0, 100), 1)
})
test("outage in window counts only the part inside the window and skips background tabs", () => {
  const gaps = [
    { from: T - 600_000, to: T - 300_000, cause: "no_contact" as const }, // 5 min, half inside
    { from: T - 200_000, to: T - 100_000, cause: "background_tab" as const },
    { from: T - 90_000, to: T - 30_000, cause: "device_offline" as const },
  ]
  const r = outageInWindow(gaps, null, T, T - 450_000, T)
  assert.equal(r.sec, 150 + 60)
  assert.equal(r.stillOut, false)
})
test("a candidate still out is measured up to now", () => {
  const r = outageInWindow([], T - 120_000, T, T - 600_000, T)
  assert.deepEqual(r, { sec: 120, stillOut: true })
})
test("recent contact is not a running outage", () => {
  const r = outageInWindow([], T - 10_000, T, T - 600_000, T)
  assert.deepEqual(r, { sec: 0, stillOut: false })
})
test("compensation: own measured amount, whole minutes rounded up", () => {
  assert.deepEqual(planCompensation({ outageSec: 241, compensatedSec: 0, extensionSec: 0, deadlineAt: T + 1, now: T }), { status: "eligible", seconds: 300 })
})
test("compensation: time already granted since the outage began is subtracted (no double pay)", () => {
  assert.equal(planCompensation({ outageSec: 300, compensatedSec: 300, extensionSec: 300, deadlineAt: T + 1, now: T }).status, "already_compensated")
  assert.deepEqual(planCompensation({ outageSec: 420, compensatedSec: 300, extensionSec: 300, deadlineAt: T + 1, now: T }), { status: "eligible", seconds: 120 })
})
test("compensation: never beyond the per-attempt cap", () => {
  const r = planCompensation({ outageSec: 3_600, compensatedSec: 0, extensionSec: EXTENSION_CAP_SEC - 150, deadlineAt: T + 1, now: T })
  assert.deepEqual(r, { status: "eligible", seconds: 120 })
  assert.equal(planCompensation({ outageSec: 600, compensatedSec: 0, extensionSec: EXTENSION_CAP_SEC, deadlineAt: T + 1, now: T }).status, "at_cap")
})
test("compensation: nothing after the time ran out, nothing without an outage", () => {
  assert.equal(planCompensation({ outageSec: 600, compensatedSec: 0, extensionSec: 0, deadlineAt: T, now: T }).status, "time_over")
  assert.equal(planCompensation({ outageSec: 0, compensatedSec: 0, extensionSec: 0, deadlineAt: T + 1, now: T }).status, "no_outage")
})
test("incident input: reason, idempotency key and a bounded window are required", () => {
  const base = { from: "2026-11-27T10:00:00Z", to: "2026-11-27T10:10:00Z", reason: "Lab 2 network outage", requestKey: crypto.randomUUID() }
  assert.ok(declareIncidentSchema.safeParse(base).success)
  assert.ok(!declareIncidentSchema.safeParse({ ...base, reason: "outage" }).success)
  assert.ok(!declareIncidentSchema.safeParse({ ...base, to: "2026-11-27T09:00:00Z" }).success)
  assert.ok(!declareIncidentSchema.safeParse({ ...base, to: "2026-11-27T17:00:01Z" }).success)
})

/* ---------- I-5.4 scoring with voids and overrides ---------- */
const single = { itemId: "s", type: "single" as const, marks: 2 }
const written = { itemId: "w", type: "written" as const, marks: 3 }
test("void exclude removes the question from score and maximum", () => {
  assert.deepEqual(itemOutcome(single, { autoScore: 2, manualScore: null }, "exclude"), { score: 0, max: 0, voided: "exclude", overridden: false, bucket: "auto" })
})
test("void full_marks awards full marks even to a blank answer", () => {
  assert.equal(itemOutcome(single, undefined, "full_marks").score, 2)
})
test("objective override after an upheld dispute wins over the automatic mark", () => {
  const o = itemOutcome(single, { autoScore: 0, manualScore: 1.5 }, null)
  assert.equal(o.score, 1.5)
  assert.equal(o.overridden, true)
})
test("written answers stay pending until graded; no row at all scores 0", () => {
  assert.equal(itemOutcome(written, { autoScore: null, manualScore: null }, null).score, null)
  assert.equal(itemOutcome(written, undefined, null).score, 0)
})
test("totals: one rule recalculates score, maximum and pending", () => {
  const rows = new Map([
    ["s", { autoScore: 2, manualScore: null }],
    ["w", { autoScore: null, manualScore: 2.5 }],
  ])
  assert.deepEqual(attemptTotals([single, written], rows, new Map()), { scoreAuto: 2, scoreManual: 2.5, scoreTotal: 4.5, maxMarks: 5, pending: 0 })
  assert.deepEqual(attemptTotals([single, written], rows, new Map([["s", "exclude"]])), { scoreAuto: 0, scoreManual: 2.5, scoreTotal: 2.5, maxMarks: 3, pending: 0 })
  const pending = new Map([["w", { autoScore: null, manualScore: null }]])
  assert.equal(attemptTotals([single, written], pending, new Map()).pending, 1)
})

/* ---------- I-5.4 dispute rules ---------- */
test("dispute window: closed before publication, open for the window, closed after", () => {
  const pub = new Date(T)
  assert.equal(disputeWindow(null).open, false)
  assert.equal(disputeWindow(pub, new Date(T + DISPUTE_WINDOW_MS - 1)).open, true)
  assert.equal(disputeWindow(pub, new Date(T + DISPUTE_WINDOW_MS)).open, false)
})
test("hotspot: two independent disputes make a pattern, one does not", () => {
  assert.equal(isHotspot(2), true)
  assert.equal(isHotspot(1), false)
  assert.equal(isHotspot(0), false)
})
test("dispute input: a real explanation and a known type are required", () => {
  const base = { attemptId: crypto.randomUUID(), itemId: crypto.randomUUID(), type: "grading_error", statement: "My answer covers rubric point 2 fully." }
  assert.ok(raiseDisputeSchema.safeParse(base).success)
  assert.ok(!raiseDisputeSchema.safeParse({ ...base, statement: "unfair" }).success)
  assert.ok(!raiseDisputeSchema.safeParse({ ...base, type: "cheating" }).success)
})
test("every decision needs an explanation; void needs a policy", () => {
  const id = crypto.randomUUID()
  assert.ok(!resolveDisputeSchema.safeParse({ disputeId: id, outcome: "reject", note: "no" }).success)
  assert.ok(!resolveDisputeSchema.safeParse({ disputeId: id, outcome: "void", note: "Two readings are possible." }).success)
  assert.ok(resolveDisputeSchema.safeParse({ disputeId: id, outcome: "void", policy: "exclude", note: "Two readings are possible." }).success)
  assert.ok(!resolveDisputeSchema.safeParse({ disputeId: id, outcome: "regrade", marks: -1, note: "Negative marks here." }).success)
})
