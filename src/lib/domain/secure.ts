/**
 * Secure sequential delivery (examiner choice per exam). Pure rules shared by the
 * server, the workspace and the tests.
 *
 * - One question at a time, in order. A question closes when the candidate submits it
 *   or when its own timer runs out; closed questions never reopen.
 * - Timers run on the server clock. If the candidate is away (locked, offline, power cut)
 *   the timers keep running: questions whose time passed are closed in order, each
 *   starting when the previous one closed. Nobody gains time by disappearing.
 * - Future questions are never sent to the browser.
 */
import type { Paper, PaperItem } from "./paper"

export const DEFAULT_TIME_LIMIT_SEC: Record<PaperItem["type"], number> = { single: 40, multi: 40, written: 180 }
export const MIN_TIME_LIMIT_SEC = 10
export const MAX_TIME_LIMIT_SEC = 3600
/** In-flight grace for the final answer of a question (same idea as the attempt deadline grace). */
export const ITEM_GRACE_MS = 3_000
/** One-time unlock codes. */
export const UNLOCK_CODE_TTL_MS = 5 * 60_000
export const MAX_UNLOCK_FAILURES = 5

export const LOCK_REASONS = ["fullscreen_exit", "tab_hidden", "window_blur", "heartbeat_hidden"] as const
export type LockReason = (typeof LOCK_REASONS)[number]
export const LOCK_REASON_LABEL: Record<LockReason, string> = {
  fullscreen_exit: "Left full screen",
  tab_hidden: "Left the exam tab",
  window_blur: "Switched to another window",
  heartbeat_hidden: "Exam tab reported hidden",
}

export const isSecure = (paper: Paper) => paper.mode === "secure"

export function limitFor(item: { type: PaperItem["type"]; timeLimitSec?: number | null }) {
  return item.timeLimitSec ?? DEFAULT_TIME_LIMIT_SEC[item.type]
}

/** When the open question closes: its own limit, never after the attempt deadline. */
export function itemDeadline(paper: Paper, cursor: number, itemStartedAt: Date, attemptDeadline: Date) {
  const item = paper.items[cursor]
  if (!item) return attemptDeadline
  return new Date(Math.min(itemStartedAt.getTime() + limitFor(item) * 1000, attemptDeadline.getTime()))
}

/**
 * Closes every question whose time has passed, in order. Returns the new cursor, the
 * new open time and which questions closed. `cursor === items.length` means the paper
 * is finished.
 */
export function advanceByTime(paper: Paper, cursor: number, itemStartedAt: Date, now: Date, attemptDeadline: Date) {
  const closed: number[] = []
  let c = cursor
  let started = itemStartedAt
  while (c < paper.items.length) {
    const due = itemDeadline(paper, c, started, attemptDeadline)
    if (now.getTime() <= due.getTime() + ITEM_GRACE_MS) break
    closed.push(c)
    c++
    started = due
  }
  return { cursor: c, itemStartedAt: started, closed, finished: c >= paper.items.length }
}

/** Total of all question timers, for the review checklist. */
export function paperTimeSec(items: { type: PaperItem["type"]; timeLimitSec?: number | null }[]) {
  return items.reduce((s, i) => s + limitFor(i), 0)
}

/**
 * Candidate-safe paper for secure mode: only the open question keeps its text and options.
 * Closed and upcoming questions keep id, type, marks and time limit for the progress ledger.
 */
export function redactForSecure(paper: Paper, cursor: number): Paper {
  return {
    mode: "secure",
    items: paper.items.map((it, i) => (i === cursor ? it : { ...it, stem: "", options: [] })),
  }
}
