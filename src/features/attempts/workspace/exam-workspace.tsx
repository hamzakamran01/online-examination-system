"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CloudOff,
  Flag,
  FlaskConical,
  LayoutGrid,
  Loader2,
  Megaphone,
  RefreshCw,
  Send,
  Timer,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
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
import { Logo } from "@/components/shell/logo"
import { fmtClock, fmtMarks } from "@/lib/format"
import type { AnswerResponse, PaperItem } from "@/lib/domain/paper"
import type { AttemptView } from "@/server/services/attempts"
import { SERVER_SNAPSHOT, SyncEngine, type Entry, type SyncState } from "./sync-engine"

type AnswerMap = Record<string, Entry>

const answered = (r: AnswerResponse | null | undefined) =>
  !!r && (r.kind === "choice" ? r.selected.length > 0 : r.text.trim().length > 0)

const TYPE_HINT = { single: "Select one answer", multi: "Select all that apply", written: "Write your answer" } as const

/* ----------------------------------------------------------------------------
 * Server-synced clock (invariant 1). The device clock only measures elapsed
 * time between server readings; it never decides the deadline.
 * ------------------------------------------------------------------------- */
function useServerClock(initialServerNow: string, initialDeadline: string) {
  const [offset, setOffset] = React.useState(() => Date.parse(initialServerNow) - Date.now())
  const [deadline, setDeadline] = React.useState(() => Date.parse(initialDeadline))
  const [now, setNow] = React.useState(() => Date.now() + offset)
  React.useEffect(() => {
    const t = setInterval(() => setNow(Date.now() + offset), 250)
    return () => clearInterval(t)
  }, [offset])
  const sync = React.useCallback((serverNow: number, dl: number) => {
    setOffset(serverNow - Date.now())
    setDeadline(dl)
  }, [])
  return { remaining: deadline - now, sync }
}

function SyncPill({ state, pending, lastSyncedAt }: { state: SyncState; pending: number; lastSyncedAt: number | null }) {
  const map = {
    saved: { icon: CheckCircle2, text: "All answers saved", cls: "text-success-text bg-success-soft" },
    saving: { icon: Loader2, text: "Saving", cls: "text-muted-foreground bg-muted" },
    retrying: { icon: RefreshCw, text: `Connection unstable, retrying${pending ? ` (${pending} pending)` : ""}`, cls: "text-warning-text bg-warning-soft" },
    offline: { icon: CloudOff, text: `Offline, ${pending} answer${pending === 1 ? "" : "s"} kept on this device`, cls: "text-warning-text bg-warning-soft" },
    error: { icon: AlertTriangle, text: "Some answers could not be saved", cls: "text-danger-text bg-danger-soft" },
  }[state]
  const Icon = map.icon
  return (
    <span
      role="status"
      aria-live="polite"
      title={lastSyncedAt ? `Last synced ${new Date(lastSyncedAt).toLocaleTimeString()}` : undefined}
      className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium", map.cls)}
    >
      <Icon className={cn("size-3.5", (state === "saving" || state === "retrying") && "animate-spin")} aria-hidden />
      <span className="max-w-[16rem] truncate">{map.text}</span>
    </span>
  )
}

function Palette({
  items,
  answers,
  current,
  onJump,
}: {
  items: PaperItem[]
  answers: AnswerMap
  current: number
  onJump: (i: number) => void
}) {
  const counts = { answered: 0, unanswered: 0, flagged: 0 }
  items.forEach((it) => {
    const a = answers[it.itemId]
    if (answered(a?.response)) counts.answered++
    else counts.unanswered++
    if (a?.flagged) counts.flagged++
  })
  return (
    <div className="space-y-4">
      <ol className="grid grid-cols-6 gap-2 sm:grid-cols-8 lg:grid-cols-5">
        {items.map((it, i) => {
          const a = answers[it.itemId]
          const isAnswered = answered(a?.response)
          const label = `Question ${i + 1}, ${isAnswered ? "answered" : "not answered"}${a?.flagged ? ", marked for review" : ""}${i === current ? ", current" : ""}`
          return (
            <li key={it.itemId}>
              <button
                type="button"
                onClick={() => onJump(i)}
                aria-label={label}
                aria-current={i === current ? "step" : undefined}
                className={cn(
                  "relative grid aspect-square w-full place-items-center rounded-lg border text-sm font-medium tabular-nums transition-colors",
                  isAnswered ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-muted",
                  i === current && "ring-3 ring-ring/60 ring-offset-1 ring-offset-background"
                )}
              >
                {i + 1}
                {a?.flagged && (
                  <span className="absolute -top-1.5 -right-1.5 grid size-4 place-items-center rounded-full bg-warning text-[0.6rem] text-black" aria-hidden>
                    <Flag className="size-2.5" />
                  </span>
                )}
              </button>
            </li>
          )
        })}
      </ol>
      <dl className="grid grid-cols-3 gap-2 text-center text-xs">
        <div className="rounded-lg bg-muted p-2">
          <dt className="flex items-center justify-center gap-1 text-muted-foreground">
            <span className="size-2.5 rounded-sm bg-primary" aria-hidden />
            Answered
          </dt>
          <dd className="text-base font-semibold tabular-nums">{counts.answered}</dd>
        </div>
        <div className="rounded-lg bg-muted p-2">
          <dt className="flex items-center justify-center gap-1 text-muted-foreground">
            <span className="size-2.5 rounded-sm border bg-background" aria-hidden />
            Unanswered
          </dt>
          <dd className="text-base font-semibold tabular-nums">{counts.unanswered}</dd>
        </div>
        <div className="rounded-lg bg-muted p-2">
          <dt className="flex items-center justify-center gap-1 text-muted-foreground">
            <Flag className="size-3 text-warning-text" aria-hidden />
            Review
          </dt>
          <dd className="text-base font-semibold tabular-nums">{counts.flagged}</dd>
        </div>
      </dl>
    </div>
  )
}

function QuestionView({
  item,
  index,
  total,
  entry,
  disabled,
  onAnswer,
}: {
  item: PaperItem
  index: number
  total: number
  entry: Entry | undefined
  disabled: boolean
  onAnswer: (r: AnswerResponse | null) => void
}) {
  const selected = entry?.response?.kind === "choice" ? entry.response.selected : []
  const text = entry?.response?.kind === "text" ? entry.response.text : ""
  const headingId = `q-${item.itemId}`

  return (
    <article aria-labelledby={headingId} className="rounded-2xl border bg-card p-5 shadow-panel sm:p-8">
      <header className="mb-5 flex flex-wrap items-center gap-2 text-sm">
        <span className="font-medium text-muted-foreground">
          Question {index + 1} of {total}
        </span>
        <Badge variant="brand">
          {fmtMarks(item.marks)} mark{item.marks === 1 ? "" : "s"}
        </Badge>
        {item.type === "multi" && item.scheme === "partial" && <Badge variant="outline">Partial credit</Badge>}
        <span className="ml-auto text-xs text-muted-foreground">{TYPE_HINT[item.type]}</span>
      </header>
      <h2 id={headingId} className="mb-6 text-[1.05em] leading-relaxed font-medium whitespace-pre-wrap">
        {item.stem}
      </h2>

      {item.type === "written" ? (
        <div className="space-y-1.5">
          <label htmlFor={`ans-${item.itemId}`} className="sr-only">
            Your answer
          </label>
          <Textarea
            id={`ans-${item.itemId}`}
            rows={10}
            value={text}
            disabled={disabled}
            spellCheck
            maxLength={20000}
            placeholder="Type your answer here"
            className="min-h-56 text-[1em] leading-relaxed"
            onChange={(e) => onAnswer(e.target.value ? { kind: "text", text: e.target.value } : null)}
          />
          <p className="text-right text-xs text-muted-foreground tabular-nums">
            {text.trim() ? text.trim().split(/\s+/).length : 0} words
          </p>
        </div>
      ) : (
        <fieldset disabled={disabled}>
          <legend className="sr-only">{TYPE_HINT[item.type]}</legend>
          <ul className="space-y-2.5">
            {item.options.map((o, oi) => {
              const checked = selected.includes(o.id)
              return (
                <li key={o.id}>
                  <label
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
                      checked ? "border-primary bg-brand-softer" : "hover:bg-muted/60"
                    )}
                  >
                    <input
                      type={item.type === "single" ? "radio" : "checkbox"}
                      name={`opt-${item.itemId}`}
                      checked={checked}
                      onChange={() => {
                        const next =
                          item.type === "single"
                            ? [o.id]
                            : checked
                              ? selected.filter((x) => x !== o.id)
                              : [...selected, o.id]
                        onAnswer(next.length ? { kind: "choice", selected: next } : null)
                      }}
                      className="mt-0.5 size-4.5 shrink-0 accent-[var(--primary)]"
                    />
                    <span className="flex-1">
                      <span className="mr-2 font-medium text-muted-foreground">{String.fromCharCode(65 + oi)}.</span>
                      {o.text}
                    </span>
                  </label>
                </li>
              )
            })}
          </ul>
          {item.type === "single" && selected.length > 0 && !disabled && (
            <button type="button" onClick={() => onAnswer(null)} className="mt-3 text-xs text-muted-foreground underline-offset-2 hover:underline">
              Clear selection
            </button>
          )}
        </fieldset>
      )}
    </article>
  )
}

export function ExamWorkspace({ view }: { view: AttemptView }) {
  const router = useRouter()
  const items = view.paper.items
  const { remaining, sync } = useServerClock(view.serverNow, view.deadlineAt)
  const [answers, setAnswers] = React.useState<AnswerMap>(view.answers)
  const [current, setCurrent] = React.useState(0)
  const [mode, setMode] = React.useState<"question" | "review">("question")
  const [paletteOpen, setPaletteOpen] = React.useState(false)
  const [confirmOpen, setConfirmOpen] = React.useState(false)
  const [submitting, setSubmitting] = React.useState(false)
  const [locked, setLocked] = React.useState<null | "time" | "submitted">(null)
  const liveRef = React.useRef<HTMLParagraphElement>(null)
  const expiredRef = React.useRef(false)

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
    // Fresh server time reading so the countdown is exact after hydration.
    const t0 = Date.now()
    fetch(`/api/attempts/${view.id}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((v) => v && sync(Date.parse(v.serverNow) + (Date.now() - t0) / 2, Date.parse(v.deadlineAt)))
      .catch(() => {})
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
      engine.stop()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Time warnings and expiry. The lock is derived from the server-synced clock.
  const timeUp = remaining <= 0
  const lockState = locked ?? (timeUp ? "time" : null)
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
    if (timeUp && !expiredRef.current) {
      expiredRef.current = true
      engine.stop()
      fetch(`/api/attempts/${view.id}/submit`, { method: "POST" })
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

  const item = items[current]
  const pending = sync$.pending
  const unansweredIdx = items.map((it, i) => (answered(answers[it.itemId]?.response) ? -1 : i)).filter((i) => i >= 0)
  const flaggedIdx = items.map((it, i) => (answers[it.itemId]?.flagged ? i : -1)).filter((i) => i >= 0)
  const low = remaining <= 5 * 60_000
  const critical = remaining <= 60_000

  const jump = (i: number) => {
    setCurrent(i)
    setMode("question")
    setPaletteOpen(false)
    window.scrollTo({ top: 0 })
  }

  return (
    <div className="min-h-dvh bg-canvas">
      <p ref={liveRef} className="sr-only" aria-live="assertive" />
      {view.isSandbox && (
        <div className="flex items-center justify-center gap-2 bg-info-soft px-4 py-1.5 text-center text-xs font-medium text-info-text">
          <FlaskConical className="size-3.5" aria-hidden />
          Sandbox preview. This attempt never affects results or statistics.
        </div>
      )}
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6">
          <Logo compact className="hidden sm:inline-flex" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{view.examTitle}</p>
            <div className="hidden sm:block">
              <SyncPill state={sync$.state} pending={pending} lastSyncedAt={sync$.lastSyncedAt} />
            </div>
          </div>
          <div
            role="timer"
            aria-label={`Time remaining ${fmtClock(remaining)}`}
            className={cn(
              "flex items-center gap-2 rounded-lg border px-3 py-1.5 font-mono text-lg font-semibold tabular-nums",
              critical ? "border-danger/40 bg-danger-soft text-danger-text" : low ? "border-warning/40 bg-warning-soft text-warning-text" : "bg-card"
            )}
          >
            <Timer className="size-4" aria-hidden />
            {fmtClock(remaining)}
          </div>
          <Button variant="outline" className="lg:hidden" onClick={() => setPaletteOpen(true)} aria-label="Show all questions">
            <LayoutGrid />
          </Button>
          <Button onClick={() => setMode("review")} disabled={!!lockState} className="hidden sm:inline-flex">
            <Send />
            Review and submit
          </Button>
        </div>
        <div className="border-t px-4 py-1.5 sm:hidden"><SyncPill state={sync$.state} pending={pending} lastSyncedAt={sync$.lastSyncedAt} /></div>
      </header>

      {lockState && (
        <div role="alert" className="mx-auto mt-4 max-w-3xl px-4">
          <div className="flex items-center gap-2 rounded-xl border border-info/30 bg-info-soft p-4 text-sm text-info-text">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            {lockState === "time" ? "Time is up. Finalizing your submission." : "Submitting."}
          </div>
        </div>
      )}

      {view.announcements.length > 0 && (
        <div className="mx-auto mt-4 max-w-7xl px-4 sm:px-6">
          <div className="flex gap-3 rounded-xl border border-info/30 bg-info-soft p-4 text-sm text-info-text">
            <Megaphone className="mt-0.5 size-4 shrink-0" aria-hidden />
            <div>
              <p className="font-medium">Announcement from your examiner</p>
              <p>{view.announcements[0].body}</p>
            </div>
          </div>
        </div>
      )}

      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[1fr_300px]">
        <main id="main" className="min-w-0">
          {mode === "question" ? (
            <>
              <QuestionView
                item={item}
                index={current}
                total={items.length}
                entry={answers[item.itemId]}
                disabled={!!lockState}
                onAnswer={(r) => update(item.itemId, { response: r }, item.type === "written" ? 900 : 300)}
              />
              <nav aria-label="Question navigation" className="mt-4 flex flex-wrap items-center gap-2">
                <Button variant="outline" disabled={current === 0} onClick={() => jump(current - 1)}>
                  <ChevronLeft />
                  Previous
                </Button>
                <Button
                  variant={answers[item.itemId]?.flagged ? "secondary" : "ghost"}
                  aria-pressed={!!answers[item.itemId]?.flagged}
                  disabled={!!lockState}
                  onClick={() => update(item.itemId, { flagged: !answers[item.itemId]?.flagged }, 300)}
                  className={cn(answers[item.itemId]?.flagged && "text-warning-text")}
                >
                  <Flag />
                  {answers[item.itemId]?.flagged ? "Marked for review" : "Mark for review"}
                </Button>
                <div className="ml-auto flex gap-2">
                  {current < items.length - 1 ? (
                    <Button onClick={() => jump(current + 1)}>
                      Next
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
          ) : (
            <section aria-labelledby="review-h" className="rounded-2xl border bg-card p-5 shadow-panel sm:p-8">
              <h2 id="review-h" className="text-xl font-semibold">
                Review before submitting
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                You can still change any answer until you submit or the time runs out.
              </p>
              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl bg-muted p-4">
                  <p className="text-xs text-muted-foreground">Answered</p>
                  <p className="text-2xl font-semibold tabular-nums">{items.length - unansweredIdx.length} / {items.length}</p>
                </div>
                <div className={cn("rounded-xl p-4", unansweredIdx.length ? "bg-warning-soft" : "bg-muted")}>
                  <p className="text-xs text-muted-foreground">Unanswered</p>
                  <p className="text-2xl font-semibold tabular-nums">{unansweredIdx.length}</p>
                </div>
                <div className={cn("rounded-xl p-4", flaggedIdx.length ? "bg-warning-soft" : "bg-muted")}>
                  <p className="text-xs text-muted-foreground">Marked for review</p>
                  <p className="text-2xl font-semibold tabular-nums">{flaggedIdx.length}</p>
                </div>
              </div>
              {[
                ["Unanswered questions", unansweredIdx],
                ["Marked for review", flaggedIdx],
              ].map(([label, list]) =>
                (list as number[]).length ? (
                  <div key={label as string} className="mt-6">
                    <p className="mb-2 text-sm font-medium">{label as string}</p>
                    <div className="flex flex-wrap gap-2">
                      {(list as number[]).map((i) => (
                        <Button key={i} variant="outline" size="sm" onClick={() => jump(i)}>
                          Question {i + 1}
                        </Button>
                      ))}
                    </div>
                  </div>
                ) : null
              )}
              {pending > 0 && (
                <p className="mt-6 flex gap-2 rounded-lg bg-warning-soft p-3 text-sm text-warning-text">
                  <CloudOff className="mt-0.5 size-4 shrink-0" aria-hidden />
                  {pending} answer{pending === 1 ? " is" : "s are"} not on the server yet. Submitting will try to sync first.
                </p>
              )}
              <div className="mt-8 flex flex-wrap justify-between gap-2">
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
          )}
        </main>

        <aside aria-label="All questions" className="hidden lg:block">
          <div className="sticky top-24 space-y-4 rounded-2xl border bg-card p-5 shadow-panel">
            <p className="text-sm font-semibold">Questions</p>
            <Palette items={items} answers={answers} current={mode === "question" ? current : -1} onJump={jump} />
            <Button variant="outline" className="w-full" onClick={() => setMode("review")} disabled={!!lockState}>
              Review and submit
            </Button>
          </div>
        </aside>
      </div>

      <Sheet open={paletteOpen} onOpenChange={setPaletteOpen}>
        <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto p-5">
          <SheetTitle>All questions</SheetTitle>
          <Palette items={items} answers={answers} current={current} onJump={jump} />
          <Button
            onClick={() => {
              setPaletteOpen(false)
              setMode("review")
            }}
            disabled={!!lockState}
          >
            Review and submit
          </Button>
        </SheetContent>
      </Sheet>

      <AlertDialog open={confirmOpen} onOpenChange={(o) => !submitting && setConfirmOpen(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Submit your exam?</AlertDialogTitle>
            <AlertDialogDescription>
              {unansweredIdx.length
                ? `You have ${unansweredIdx.length} unanswered question${unansweredIdx.length === 1 ? "" : "s"}. `
                : "All questions are answered. "}
              After submitting you cannot change your answers.
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
