"use client"

/**
 * Local answer journal + sync queue (C-3.5.2, S-4.1, I-5.3).
 *
 * Every change gets a monotonically increasing sequence number and is written
 * to localStorage before any network call, so a refresh, crash or power cut
 * loses nothing on this device. The queue flushes in batches; the server only
 * applies a change when its sequence is newer than what it already stored, so
 * retries and out-of-order deliveries are harmless.
 */
import type { AnswerResponse } from "@/lib/domain/paper"

export type Entry = { response: AnswerResponse | null; flagged: boolean; seq: number }
export type SyncState = "saved" | "saving" | "offline" | "retrying" | "error"
export type Snapshot = { state: SyncState; pending: number; lastSyncedAt: number | null }
export const SERVER_SNAPSHOT: Snapshot = { state: "saved", pending: 0, lastSyncedAt: null }
type FlushOutcome = { kind: "finalized"; reason: string } | { kind: "unauthorized" }
type Listener = () => void

const isBrowser = () => typeof window !== "undefined"

const store = {
  get<T>(key: string, fallback: T): T {
    if (!isBrowser()) return fallback
    try {
      const raw = window.localStorage.getItem(key)
      return raw ? (JSON.parse(raw) as T) : fallback
    } catch {
      return fallback
    }
  },
  set(key: string, value: unknown) {
    if (!isBrowser()) return
    try {
      window.localStorage.setItem(key, JSON.stringify(value))
    } catch {
      /* storage full or blocked: the in-memory queue still works */
    }
  },
}

export function getClientId() {
  let id = store.get<string | null>("ev:client", null)
  if (!id) {
    id = crypto.randomUUID()
    store.set("ev:client", id)
  }
  return id
}

export class SyncEngine {
  private pending: Record<string, Entry>
  private seq: number
  private inflight = false
  private timer: ReturnType<typeof setTimeout> | null = null
  private failures = 0
  private listeners = new Set<Listener>()
  private stopped = false
  private state: SyncState = "saved"
  private lastSyncedAt: number | null = null
  private snapshot: Snapshot = SERVER_SNAPSHOT
  private onServerTime: (serverNow: number, deadline: number) => void = () => {}
  private onTerminal: (o: FlushOutcome) => void = () => {}

  constructor(
    private attemptId: string,
    serverSeqMax: number
  ) {
    this.pending = store.get<Record<string, Entry>>(this.key("journal"), {})
    this.seq = Math.max(serverSeqMax, store.get<number>(this.key("seq"), 0))
  }

  /** Callbacks close over React state, so they are wired after mount. */
  bind(onServerTime: (serverNow: number, deadline: number) => void, onTerminal: (o: FlushOutcome) => void) {
    this.onServerTime = onServerTime
    this.onTerminal = onTerminal
    this.stopped = false
  }

  private key(k: string) {
    return `ev:${k}:${this.attemptId}`
  }

  /* useSyncExternalStore contract: stable subscribe and immutable snapshots. */
  subscribe = (fn: Listener) => {
    this.listeners.add(fn)
    return () => void this.listeners.delete(fn)
  }
  getSnapshot = () => this.snapshot
  private emit() {
    this.snapshot = { state: this.state, pending: this.pendingCount, lastSyncedAt: this.lastSyncedAt }
    this.listeners.forEach((l) => l())
  }
  private setState(s: SyncState) {
    this.state = s
    this.emit()
  }

  get pendingCount() {
    return Object.keys(this.pending).length
  }

  /** Journal entries newer than the server copy (e.g. refreshed while offline). */
  restorable(serverSeqs: Record<string, number>) {
    return Object.entries(this.pending).filter(([itemId, e]) => e.seq > (serverSeqs[itemId] ?? 0))
  }
  dropStale(serverSeqs: Record<string, number>) {
    for (const [itemId, e] of Object.entries(this.pending)) if (e.seq <= (serverSeqs[itemId] ?? 0)) delete this.pending[itemId]
    store.set(this.key("journal"), this.pending)
    this.emit()
  }

  record(itemId: string, response: AnswerResponse | null, flagged: boolean, debounceMs = 500): Entry {
    const entry = { response, flagged, seq: ++this.seq }
    this.pending[itemId] = entry
    store.set(this.key("seq"), this.seq)
    store.set(this.key("journal"), this.pending)
    this.emit()
    this.schedule(debounceMs)
    return entry
  }

  schedule(ms: number) {
    if (this.stopped) return
    if (this.timer) clearTimeout(this.timer)
    this.timer = setTimeout(() => void this.flush(), ms)
  }

  async flush(): Promise<void> {
    if (this.stopped || this.inflight) return
    const batch = Object.entries(this.pending).map(([itemId, e]) => ({ itemId, ...e }))
    if (!batch.length) {
      this.setState("saved")
      return
    }
    if (!navigator.onLine) {
      this.setState("offline")
      return
    }
    this.inflight = true
    this.setState(this.failures ? "retrying" : "saving")
    const sentAt = performance.now()
    try {
      const res = await fetch(`/api/attempts/${this.attemptId}/answers`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: getClientId(), answers: batch }),
        cache: "no-store",
      })
      const body = await res.json().catch(() => null)
      this.inflight = false
      if (res.ok) {
        for (const a of body.acked as { itemId: string; seq: number }[])
          if (this.pending[a.itemId]?.seq === a.seq) delete this.pending[a.itemId]
        store.set(this.key("journal"), this.pending)
        this.onServerTime(Date.parse(body.serverNow) + (performance.now() - sentAt) / 2, Date.parse(body.deadlineAt))
        this.failures = 0
        this.lastSyncedAt = Date.now()
        if (this.pendingCount) return this.flush()
        this.setState("saved")
        return
      }
      const code = body?.error?.code as string | undefined
      if (res.status === 409) {
        this.stop()
        this.onTerminal({ kind: "finalized", reason: code ?? "CONFLICT" })
        return
      }
      if (res.status === 401) {
        this.stop()
        this.onTerminal({ kind: "unauthorized" })
        return
      }
      if (res.status === 400) {
        // A malformed entry would block the queue forever: drop the batch and report it.
        this.pending = {}
        store.set(this.key("journal"), this.pending)
        this.setState("error")
        return
      }
      throw new Error(`HTTP ${res.status}`)
    } catch {
      this.inflight = false
      this.failures++
      this.setState(navigator.onLine ? "retrying" : "offline")
      this.schedule(Math.min(15_000, 1000 * 2 ** Math.min(this.failures, 4)))
    }
  }

  stop() {
    this.stopped = true
    if (this.timer) clearTimeout(this.timer)
  }

  clearJournal() {
    this.pending = {}
    store.set(this.key("journal"), {})
    this.emit()
  }
}
