import { test } from "node:test"
import assert from "node:assert/strict"
import {
  DISCONNECT_AFTER_MS,
  EXTENSION_CAP_SEC,
  GAP_THRESHOLD_MS,
  deriveLiveState,
  measureGapSec,
  suggestExtensionSec,
} from "../src/lib/domain/monitoring"
import { announcementSchema, extensionSchema, heartbeatSchema } from "../src/lib/validation/monitoring"

const now = new Date("2026-11-27T10:00:00Z")
const ago = (ms: number) => new Date(now.getTime() - ms)

test("live state: no attempt is not started", () => {
  assert.equal(deriveLiveState(null, now), "not_started")
})

test("live state: finalized attempts are submitted whatever the last contact", () => {
  assert.equal(deriveLiveState({ status: "submitted", lastSeenAt: ago(3_600_000), startedAt: ago(4_000_000) }, now), "submitted")
  assert.equal(deriveLiveState({ status: "auto_submitted", lastSeenAt: null, startedAt: ago(10) }, now), "submitted")
})

test("live state: writing until the disconnect threshold, then disconnected", () => {
  const at = (ms: number) => deriveLiveState({ status: "in_progress", lastSeenAt: ago(ms), startedAt: ago(600_000) }, now)
  assert.equal(at(0), "writing")
  assert.equal(at(DISCONNECT_AFTER_MS), "writing")
  assert.equal(at(DISCONNECT_AFTER_MS + 1), "disconnected")
})

test("live state: falls back to start time when never seen", () => {
  assert.equal(deriveLiveState({ status: "in_progress", lastSeenAt: null, startedAt: ago(5_000) }, now), "writing")
  assert.equal(deriveLiveState({ status: "in_progress", lastSeenAt: null, startedAt: ago(60_000) }, now), "disconnected")
})

test("gap: normal heartbeat jitter is not a gap", () => {
  assert.equal(measureGapSec(null, now), null)
  assert.equal(measureGapSec(ago(15_000), now), null)
  assert.equal(measureGapSec(ago(GAP_THRESHOLD_MS), now), null)
})

test("gap: silence beyond the threshold is measured in whole seconds", () => {
  assert.equal(measureGapSec(ago(GAP_THRESHOLD_MS + 1), now), 45)
  assert.equal(measureGapSec(ago(312_400), now), 312)
})

test("extension suggestion: covers the uncompensated outage, rounded up to minutes", () => {
  assert.equal(suggestExtensionSec(130, 0), 180)
  assert.equal(suggestExtensionSec(130, 60), 120)
  assert.equal(suggestExtensionSec(0, 0), 60)
})

test("extension suggestion: never exceeds the remaining cap", () => {
  assert.equal(suggestExtensionSec(3_600, 0), EXTENSION_CAP_SEC)
  assert.equal(suggestExtensionSec(3_600, EXTENSION_CAP_SEC - 120), 120)
  assert.equal(suggestExtensionSec(3_600, EXTENSION_CAP_SEC), 0)
})

test("heartbeat schema: rejects server-only event types from the client", () => {
  assert.equal(heartbeatSchema.safeParse({ clientId: "client-123", signals: [{ type: "connection_gap" }] }).success, false)
  assert.equal(heartbeatSchema.safeParse({ clientId: "client-123", signals: [{ type: "extension_granted" }] }).success, false)
  assert.equal(heartbeatSchema.safeParse({ clientId: "client-123", signals: [{ type: "tab_hidden", durationMs: 4000 }] }).success, true)
})

test("heartbeat schema: bounds batch size and timestamps", () => {
  const many = Array.from({ length: 51 }, () => ({ type: "reconnect" as const }))
  assert.equal(heartbeatSchema.safeParse({ clientId: "client-123", signals: many }).success, false)
  assert.equal(heartbeatSchema.safeParse({ clientId: "client-123", signals: [{ type: "reconnect", at: Number.MAX_SAFE_INTEGER }] }).success, false)
  assert.deepEqual(heartbeatSchema.parse({ clientId: "client-123" }).signals, [])
})

test("announcement schema: trims and bounds the body", () => {
  assert.equal(announcementSchema.safeParse({ body: "  " }).success, false)
  assert.equal(announcementSchema.safeParse({ body: "x".repeat(501) }).success, false)
  assert.equal(announcementSchema.parse({ body: "  Read Q4 as metres.  " }).body, "Read Q4 as metres.")
})

test("extension schema: whole minutes within the cap and a real reason", () => {
  const id = "4f1c2b8e-8c1a-4d55-9a1e-2a3b4c5d6e7f"
  assert.equal(extensionSchema.safeParse({ attemptId: id, minutes: 5, reason: "Outage measured" }).success, true)
  assert.equal(extensionSchema.safeParse({ attemptId: id, minutes: "5", reason: "Outage measured" }).success, true)
  assert.equal(extensionSchema.safeParse({ attemptId: id, minutes: 0, reason: "Outage measured" }).success, false)
  assert.equal(extensionSchema.safeParse({ attemptId: id, minutes: 1.5, reason: "Outage measured" }).success, false)
  assert.equal(extensionSchema.safeParse({ attemptId: id, minutes: EXTENSION_CAP_SEC / 60 + 1, reason: "Outage measured" }).success, false)
  assert.equal(extensionSchema.safeParse({ attemptId: id, minutes: 5, reason: "  ok " }).success, false)
})
