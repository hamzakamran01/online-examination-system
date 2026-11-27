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

const store = {
  get<T>(key: string, fallback: T): T {
    try {
      const raw = window.localStorage.getItem(key)
      return raw ? (JSON.parse(raw) as T) : fallback
    } catch {
      return fallback
    }
  },
  set(key: string, value: unknown) {
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

type Listener = () => void
type FlushOutcome = { kind: "finalized"; reason: string } | { kind: "unauthorized" }

export class SyncEngine {
  private pending: Record<string, Entry>
  private seq: number
  private inflight = false
  private timer: ReturnType<typeof setTimeout> | null = null
  private failures = 0
  private listeners = new Set<Listener>()
  private stopped = false
  state: SyncState = "saved"
  lastSyncedAt: number | null = null
  offsetMs = 0

  constructor(
    private attemptId: string,
    serverSeqMax: number,
    private onServerTime: (serverNow: number, deadline: number) => void,
    private onTerminal: (o: FlushOutcome) => void
  ) {
    this.pending = store.get<Record<string, Entry>>(this.key("journal"), {})
    this.seq = Math.max(serverSeqMax, store.get<number>(this.key("seq"), 0))
  }

  private key(k: string) {
    return `ev:${k}:${this.attemptId}`
  }

  subscribe(fn: Listener) {
    this.listeners.add(fn)
    return () => void this.listeners.delete(fn)
  }
  private emit() {
    this.listeners.forEach((l) => l())
  }
  private setState(s: SyncState) {
    if (this.state !== s) {
      this.state = s
      this.emit()
    }
  }

  get pendingCount() {
    return Object.keys(this.pending).length
  }
  /** Journal entries newer than the server copy (restored after refresh while offline). */
  restorable(serverSeqs: Record<string, number>) {
    return Object.entries(this.pending).filter(([itemId, e]) => e.seq > (serverSeqs[itemId] ?? 0))
  }
  dropStale(serverSeqs: Record<string, number>) {
    for (const [itemId, e] of Object.entries(this.pending)) if (e.seq <= (serverSeqs[itemId] ?? 0)) delete this.pending[itemId]
    store.set(this.key("journal"), this.pending)
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
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      this.setState("offline")
      return
    }
    this.inflight = true
    this.setState(this.failures ? "retrying" : "saving")
    const sentAt = Date.now()
    try {
      const res = await fetch(`/api/attempts/${this.attemptId}/answers`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: getClientId(), answers: batch }),
        cache: "no-store",
      })
      const body = await res.json().catch(() => null)
      if (res.ok) {
        for (const a of body.acked as { itemId: string; seq: number }[])
          if (this.pending[a.itemId]?.seq === a.seq) delete this.pending[a.itemId]
        store.set(this.key("journal"), this.pending)
        const rtt = Date.now() - sentAt
        this.onServerTime(Date.parse(body.serverNow) + rtt / 2, Date.parse(body.deadlineAt))
        this.failures = 0
        this.lastSyncedAt = Date.now()
        this.inflight = false
        if (this.pendingCount) return this.flush()
        this.setState("saved")
        return
      }
      this.inflight = false
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
        // A malformed entry would block the queue forever: drop it, keep the rest.
        this.pending = {}
        store.set(this.key("journal"), this.pending)
        this.setState("error")
        return
      }
      throw new Error(`HTTP ${res.status}`)
    } catch {
      this.inflight = false
      this.failures++
      this.setState(typeof navigator !== "undefined" && !navigator.onLine ? "offline" : "retrying")
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
  }
}
