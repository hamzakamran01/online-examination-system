"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { ChevronLeft, ChevronRight, Flag, FlaskConical, LayoutGrid, Loader2, Send, SlidersHorizontal } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { LogoMark } from "@/components/shell/logo"
import { fmtClock } from "@/lib/format"
import type { AnswerResponse } from "@/lib/domain/paper"
import type { Preferences } from "@/lib/validation/workspace"
import type { AttemptView } from "@/server/services/attempts"
import { SERVER_SNAPSHOT, SyncEngine, type Entry } from "./sync-engine"
import { Palette, QuestionView, SyncStatus, TimeRail, answered } from "./workspace-ui"
import { PreferencesPanel } from "./preferences-panel"
import { Scratchpad } from "./scratchpad"
import { useAttemptRuntime } from "./use-attempt-runtime"
import { AnnouncementBanner } from "./announcement-banner"
import { NetworkBanner, UNSYNCED_WARNING_MS } from "./network-banner"
import "./contrast.css"

type AnswerMap = Record<string, Entry>

/* ----------------------------------------------------------------------------
 * Server-synced clock (invariant 1). A server timestamp is paired with a
 * performance.now() reading; performance.now() is monotonic, so changing the
 * device date or time cannot move the countdown.
 * ------------------------------------------------------------------------- */
function useServerClock(initialServerNow: string, initialDeadline: string) {
  const [point, setPoint] = React.useState(() => ({ server: Date.parse(initialServerNow), mono: performance.now() }))
  const [deadline, setDeadline] = React.useState(() => Date.parse(initialDeadline))
  const [now, setNow] = React.useState(() => Date.parse(initialServerNow))
  React.useEffect(() => {
    const t = setInterval(() => setNow(point.server + (performance.now() - point.mono)), 250)
    return () => clearInterval(t)
  }, [point])
  const sync = React.useCallback((serverNow: number, dl: number) => {
    setPoint({ server: serverNow, mono: performance.now() })
    setDeadline(dl)
  }, [])
  return { remaining: deadline - now, deadline, sync }
}

/** Display preferences (S-4.7). Font scale applies at the root so rem-sized controls scale too. */
function usePreferences(initial: Preferences) {
  const [prefs, setPrefs] = React.useState(initial)
  React.useEffect(() => {
    const root = document.documentElement
    const before = root.style.fontSize
    root.style.fontSize = `${prefs.fontScale}%`
    return () => {
      root.style.fontSize = before
    }
  }, [prefs.fontScale])
  const themeClass = prefs.theme === "contrast" ? "contrast" : prefs.theme === "dark" ? "dark" : prefs.theme === "light" ? "light-scope" : ""
  return { prefs, setPrefs, themeClass }
}

export function ExamWorkspace({ view, preferences }: { view: AttemptView; preferences: Preferences }) {
  const router = useRouter()
  const items = view.paper.items
  const { remaining, deadline, sync } = useServerClock(view.serverNow, view.deadlineAt)
  const { prefs, setPrefs, themeClass } = usePreferences(preferences)
  const [answers, setAnswers] = React.useState<AnswerMap>(view.answers)
  const [current, setCurrent] = React.useState(0)
  const [visited, setVisited] = React.useState<Set<string>>(
    () => new Set([...(items[0] ? [items[0].itemId] : []), ...Object.keys(view.answers)])
  )
  const [mode, setMode] = React.useState<"question" | "review">("question")
  const [paletteOpen, setPaletteOpen] = React.useState(false)
  const [prefsOpen, setPrefsOpen] = React.useState(false)
  const [confirmOpen, setConfirmOpen] = React.useState(false)
  const [submitting, setSubmitting] = React.useState(false)
  const [locked, setLocked] = React.useState<null | "time" | "submitted">(null)
  const liveRef = React.useRef<HTMLParagraphElement>(null)
  const headingRef = React.useRef<HTMLHeadingElement>(null)
  const expiredRef = React.useRef(false)
  const totalMs = Math.max(1, Date.parse(view.deadlineAt) - Date.parse(view.startedAt))

  const finish = React.useCallback(() => router.replace(`/attempt/${view.id}/done`), [router, view.id])

  // One engine per attempt. It touches localStorage only in the browser.
  const [engine] = React.useState(() => new SyncEngine(view.id, Math.max(0, ...Object.values(view.answers).map((a) => a.seq))))
  const sync$ = React.useSyncExternalStore(engine.subscribe, engine.getSnapshot, () => SERVER_SNAPSHOT)

  // Restore unsynced journal entries (refresh while offline) and start syncing.
  React.useEffect(() => {
    engine.bind(sync, (o) => {
      if (o.kind === "unauthorized") toast.error("Your session ended. Sign in again to continue; your answers are kept on this device.")
      else {
        setLocked("time")
        toast.info("Time is up. Your exam was submitted with the answers saved before the deadline.")
        setTimeout(finish, 1500)
      }
    })
    const serverSeqs = Object.fromEntries(Object.entries(view.answers).map(([k, v]) => [k, v.seq]))
    const restore = engine.restorable(serverSeqs)
    if (restore.length) {
      queueMicrotask(() => setAnswers((a) => ({ ...a, ...Object.fromEntries(restore) })))
      toast.info(`Restored ${restore.length} answer${restore.length === 1 ? "" : "s"} saved on this device.`)
    }
    engine.dropStale(serverSeqs)
    void engine.flush()
    // Fresh server time reading (after hydration, and whenever the tab regains focus).
    const resync = () => {
      const t0 = performance.now()
      fetch(`/api/attempts/${view.id}`, { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((v) => {
          if (!v) return
          sync(Date.parse(v.serverNow) + (performance.now() - t0) / 2, Date.parse(v.deadlineAt))
          if (v.status !== "in_progress") finish()
        })
        .catch(() => {})
    }
    resync()
    const onVisible = () => document.visibilityState === "visible" && resync()
    document.addEventListener("visibilitychange", onVisible)
    const online = () => {
      toast.success("Back online. Syncing your answers.")
      void engine.flush()
    }
    const offline = () => {
      toast.warning("You are offline. Keep working: answers are kept on this device and sync when you reconnect.")
      void engine.flush()
    }
    window.addEventListener("online", online)
    window.addEventListener("offline", offline)
    const poll = setInterval(() => engine.pendingCount && void engine.flush(), 10_000)
    return () => {
      clearInterval(poll)
      window.removeEventListener("online", online)
      window.removeEventListener("offline", offline)
      document.removeEventListener("visibilitychange", onVisible)
      engine.stop()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Time warnings and expiry. The lock is derived from the server-synced clock.
  const timeUp = remaining <= 0
  const lockState = locked ?? (timeUp ? "time" : null)

  // Heartbeat, announcements, extensions and review signals (C-3.6, I-5.3).
  const runtime = useAttemptRuntime({
    attemptId: view.id,
    initialAnnouncements: view.announcements,
    locked: !!lockState,
    onServerTime: sync,
    onFinalized: finish,
  })
  const warned = React.useRef<Set<number>>(new Set())
  React.useEffect(() => {
    for (const m of [10, 5, 1]) {
      if (remaining <= m * 60_000 && remaining > (m - 1) * 60_000 + 50_000 && !warned.current.has(m)) {
        warned.current.add(m)
        const msg = `${m} minute${m === 1 ? "" : "s"} remaining.${engine.pendingCount ? " Some answers are still waiting to sync." : ""}`
        toast.warning(msg)
        if (liveRef.current) liveRef.current.textContent = msg
      }
    }
    // T-2 min: unsynced answers get one loud, specific warning (I-5.3). The banner stays up until they sync.
    if (remaining > 0 && remaining <= UNSYNCED_WARNING_MS && engine.pendingCount && !warned.current.has(-2)) {
      warned.current.add(-2)
      const msg = `Under 2 minutes left and ${engine.pendingCount} answer${engine.pendingCount === 1 ? " is" : "s are"} not on the server yet. Reconnect now.`
      toast.error(msg, { duration: 15_000 })
      if (liveRef.current) liveRef.current.textContent = msg
      void engine.flush()
    }
    if (timeUp && !expiredRef.current) {
      expiredRef.current = true
      // Send anything still queued (the server accepts in-flight saves for a short grace), then finalize.
      void engine
        .flush()
        .catch(() => {})
        .then(() => {
          engine.stop()
          return fetch(`/api/attempts/${view.id}/submit`, { method: "POST" })
        })
        .catch(() => {})
        .finally(() => setTimeout(finish, 1200))
    }
  }, [remaining, timeUp, engine, view.id, finish])

  const update = (itemId: string, patch: { response?: AnswerResponse | null; flagged?: boolean }, debounce = 500) => {
    if (lockState) return
    const cur = answers[itemId]
    const response = patch.response !== undefined ? patch.response : (cur?.response ?? null)
    const flagged = patch.flagged ?? cur?.flagged ?? false
    const entry = engine.record(itemId, response, flagged, debounce)
    setAnswers((prev) => ({ ...prev, [itemId]: entry }))
  }

  const submit = async () => {
    setSubmitting(true)
    await engine.flush()
    if (engine.pendingCount) {
      setSubmitting(false)
      toast.error("Some answers have not reached the server yet. Reconnect, wait for “All answers saved”, then submit.")
      return
    }
    try {
      const res = await fetch(`/api/attempts/${view.id}/submit`, { method: "POST" })
      if (!res.ok && res.status !== 409) throw new Error()
      engine.stop()
      engine.clearJournal()
      setLocked("submitted")
      finish()
    } catch {
      setSubmitting(false)
      toast.error("Could not submit. Check your connection and try again. Your answers are safe.")
    }
  }

  const scrollLayout = prefs.layout === "scroll"
  const item = items[current]
  const pending = sync$.pending
  // Per-question markers only while sync is stalled; during normal saving they would flicker on every keystroke.
  const stalled = sync$.state === "offline" || sync$.state === "retrying" || sync$.state === "error"
  const unsynced = React.useMemo(() => new Set(stalled ? sync$.pendingIds : []), [stalled, sync$.pendingIds])
  const unansweredIdx = items.map((it, i) => (answered(answers[it.itemId]?.response) ? -1 : i)).filter((i) => i >= 0)
  const flaggedIdx = items.map((it, i) => (answers[it.itemId]?.flagged ? i : -1)).filter((i) => i >= 0)
  const low = remaining <= 5 * 60_000
  const critical = remaining <= 60_000
  const deadlineLabel = new Date(deadline).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })

  const jump = (i: number) => {
    const target = items[i]
    if (target) setVisited((prev) => (prev.has(target.itemId) ? prev : new Set(prev).add(target.itemId)))
    setCurrent(i)
    setMode("question")
    setPaletteOpen(false)
    if (scrollLayout) {
      document.getElementById(`question-${i + 1}`)?.scrollIntoView({ behavior: "smooth", block: "start" })
    } else {
      window.scrollTo({ top: 0 })
      // Move focus to the new question so keyboard and screen reader users land on it.
      requestAnimationFrame(() => headingRef.current?.focus({ preventScroll: true }))
    }
  }

  const flagButton = (itemId: string) => (
    <Button
      variant="outline"
      aria-pressed={!!answers[itemId]?.flagged}
      disabled={!!lockState}
      onClick={() => update(itemId, { flagged: !answers[itemId]?.flagged }, 300)}
      className={cn(answers[itemId]?.flagged && "border-time/50 bg-time-soft text-time-text hover:bg-time-soft")}
    >
      <Flag />
      {answers[itemId]?.flagged ? "Marked for review" : "Mark for review"}
    </Button>
  )

  const palette = (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border bg-surface p-4">
        <Palette items={items} answers={answers} visited={visited} current={mode === "question" ? current : -1} onJump={jump} unsynced={unsynced} />
        <Button variant="outline" className="mt-4 w-full" onClick={() => setMode("review")} disabled={!!lockState}>
          Review and submit
        </Button>
      </div>
      <Scratchpad attemptId={view.id} initial={view.scratchpad} />
    </div>
  )

  return (
    <div className={cn("min-h-dvh bg-canvas text-foreground", themeClass)}>
      <p ref={liveRef} className="sr-only" aria-live="assertive" />

      {view.isSandbox && (
        <div className="flex items-center justify-center gap-2 bg-info-soft px-4 py-1.5 text-center text-xs font-medium text-info-text">
          <FlaskConical className="size-3.5" aria-hidden />
          Sandbox preview. This attempt never counts in results or statistics.
        </div>
      )}

      <header className="sticky top-0 z-30 border-b bg-surface/95 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-[1240px] items-center gap-3 px-4 sm:px-6">
          <LogoMark className="hidden sm:grid" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{view.examTitle}</p>
            <SyncStatus state={sync$.state} pending={pending} lastSyncedAt={sync$.lastSyncedAt} />
          </div>

          <div
            role="timer"
            aria-label={`Time remaining ${fmtClock(remaining)}`}
            className={cn(
              "flex flex-col items-end rounded-lg px-3 py-1",
              critical ? "bg-danger-soft text-danger-text" : low ? "bg-time-soft text-time-text" : "bg-surface-sunken"
            )}
          >
            <span className="font-mono text-lg leading-tight font-semibold tabular-nums">{fmtClock(remaining)}</span>
            <span className="hidden text-[0.68rem] leading-tight opacity-80 sm:block">ends {deadlineLabel} server time</span>
          </div>

          <Button variant="ghost" size="icon" aria-label="Display settings" onClick={() => setPrefsOpen(true)}>
            <SlidersHorizontal />
          </Button>
          <Button variant="outline" size="icon" className="lg:hidden" onClick={() => setPaletteOpen(true)} aria-label="Show all questions">
            <LayoutGrid />
          </Button>
          <Button onClick={() => setMode("review")} disabled={!!lockState} className="hidden sm:inline-flex">
            <Send />
            Review and submit
          </Button>
        </div>
        <TimeRail remaining={remaining} total={totalMs} />
      </header>

      {lockState && (
        <div role="alert" className="mx-auto mt-4 max-w-[1240px] px-4 sm:px-6">
          <div className="flex items-center gap-2 rounded-xl border border-info/30 bg-info-soft px-4 py-3 text-sm text-info-text">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            {lockState === "time" ? "Time is up. Finalizing your submission with every answer saved before the deadline." : "Submitting."}
          </div>
        </div>
      )}

      <NetworkBanner
        state={sync$.state}
        pending={pending}
        lastSyncedAt={sync$.lastSyncedAt}
        serverReachable={runtime.serverReachable}
        remaining={remaining}
        locked={!!lockState}
        onRetry={() => {
          void engine.flush()
          void runtime.beatNow()
        }}
      />
      <AnnouncementBanner all={runtime.announcements} visible={runtime.visible} onDismiss={runtime.dismiss} />

      <div
        className={cn(
          "mx-auto grid max-w-[1240px] gap-6 px-4 py-6 sm:px-6 lg:py-8",
          prefs.paletteSide === "left" ? "lg:grid-cols-[300px_minmax(0,1fr)]" : "lg:grid-cols-[minmax(0,1fr)_300px]"
        )}
      >
        <main id="main" className={cn("min-w-0", prefs.paletteSide === "left" && "lg:order-2")}>
          {mode === "review" ? (
            <section aria-labelledby="review-h" className="rounded-xl border bg-surface p-5 sm:p-8">
              <h2 id="review-h" className="font-display text-2xl font-semibold">
                Review before submitting
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">You can change any answer until you submit or the time runs out.</p>
              <div className="mt-6 grid grid-cols-3 gap-px overflow-hidden rounded-xl border bg-border">
                {[
                  ["Answered", `${items.length - unansweredIdx.length} / ${items.length}`, ""],
                  ["Unanswered", String(unansweredIdx.length), unansweredIdx.length ? "text-time-text" : ""],
                  ["For review", String(flaggedIdx.length), flaggedIdx.length ? "text-time-text" : ""],
                ].map(([label, value, tone]) => (
                  <div key={label} className="bg-surface px-4 py-3">
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className={cn("font-display text-2xl font-semibold tabular-nums", tone)}>{value}</p>
                  </div>
                ))}
              </div>
              {(
                [
                  ["Unanswered questions", unansweredIdx],
                  ["Marked for review", flaggedIdx],
                ] as const
              ).map(([label, list]) =>
                list.length ? (
                  <div key={label} className="mt-6">
                    <p className="mb-2 text-sm font-medium">{label}</p>
                    <div className="flex flex-wrap gap-2">
                      {list.map((i) => (
                        <Button key={i} variant="outline" size="sm" onClick={() => jump(i)}>
                          Question {i + 1}
                        </Button>
                      ))}
                    </div>
                  </div>
                ) : null
              )}
              {pending > 0 && (
                <p className="mt-6 rounded-lg bg-time-soft px-4 py-3 text-sm text-time-text">
                  {pending} answer{pending === 1 ? " is" : "s are"} still on this device only. Submitting sends them first.
                </p>
              )}
              <div className="mt-8 flex flex-wrap justify-between gap-2 border-t pt-6">
                <Button variant="outline" onClick={() => setMode("question")}>
                  <ChevronLeft />
                  Back to questions
                </Button>
                <Button onClick={() => setConfirmOpen(true)} disabled={!!lockState || submitting}>
                  <Send />
                  Submit exam
                </Button>
              </div>
            </section>
          ) : scrollLayout ? (
            <div className="flex flex-col gap-4">
              {items.map((it, i) => (
                <div key={it.itemId} className="flex flex-col gap-2">
                  <QuestionView
                    item={it}
                    index={i}
                    total={items.length}
                    entry={answers[it.itemId]}
                    unsynced={unsynced.has(it.itemId)}
                    disabled={!!lockState}
                    onAnswer={(r) => {
                      setVisited((prev) => (prev.has(it.itemId) ? prev : new Set(prev).add(it.itemId)))
                      update(it.itemId, { response: r }, it.type === "written" ? 900 : 300)
                    }}
                  />
                  <div className="flex justify-end">{flagButton(it.itemId)}</div>
                </div>
              ))}
              <Button className="self-end" onClick={() => setMode("review")} disabled={!!lockState}>
                Review answers
                <ChevronRight />
              </Button>
            </div>
          ) : (
            <>
              <QuestionView
                item={item}
                index={current}
                total={items.length}
                entry={answers[item.itemId]}
                unsynced={unsynced.has(item.itemId)}
                disabled={!!lockState}
                headingRef={headingRef}
                onAnswer={(r) => update(item.itemId, { response: r }, item.type === "written" ? 900 : 300)}
              />
              <nav aria-label="Question navigation" className="mt-4 flex flex-wrap items-center gap-2">
                <Button variant="outline" disabled={current === 0} onClick={() => jump(current - 1)}>
                  <ChevronLeft />
                  Previous
                </Button>
                {flagButton(item.itemId)}
                <div className="ml-auto">
                  {current < items.length - 1 ? (
                    <Button onClick={() => jump(current + 1)}>
                      Next question
                      <ChevronRight />
                    </Button>
                  ) : (
                    <Button onClick={() => setMode("review")} disabled={!!lockState}>
                      Review answers
                      <ChevronRight />
                    </Button>
                  )}
                </div>
              </nav>
            </>
          )}
        </main>

        <aside aria-label="Questions and notes" className={cn("hidden lg:block", prefs.paletteSide === "left" && "lg:order-1")}>
          <div className="sticky top-24">{palette}</div>
        </aside>
      </div>

      <Sheet open={paletteOpen} onOpenChange={setPaletteOpen}>
        <SheetContent side="bottom" className="max-h-[88dvh] overflow-y-auto p-5">
          <SheetTitle>All questions</SheetTitle>
          {palette}
        </SheetContent>
      </Sheet>

      <Sheet open={prefsOpen} onOpenChange={setPrefsOpen}>
        <SheetContent side="right" className="w-full max-w-md overflow-y-auto p-5 sm:max-w-md">
          <SheetTitle>Display settings</SheetTitle>
          <p className="text-sm text-muted-foreground">Saved to your account. They apply to every exam you take.</p>
          <PreferencesPanel value={prefs} onChange={setPrefs} />
        </SheetContent>
      </Sheet>

      <AlertDialog open={confirmOpen} onOpenChange={(o) => !submitting && setConfirmOpen(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Submit your exam?</AlertDialogTitle>
            <AlertDialogDescription>
              {unansweredIdx.length
                ? `${unansweredIdx.length} question${unansweredIdx.length === 1 ? " is" : "s are"} unanswered. `
                : "Every question is answered. "}
              After submitting you cannot change any answer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Keep working</AlertDialogCancel>
            <Button onClick={submit} disabled={submitting}>
              {submitting && <Loader2 className="animate-spin" aria-hidden />}
              Submit now
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
