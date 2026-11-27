"use client"

import * as React from "react"
import { AlertTriangle, CheckCircle2, CloudOff, Flag, Loader2, RefreshCw, Undo2, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Textarea } from "@/components/ui/textarea"
import { fmtMarks } from "@/lib/format"
import type { AnswerResponse, PaperItem } from "@/lib/domain/paper"
import type { Entry, SyncState } from "./sync-engine"

export const answered = (r: AnswerResponse | null | undefined) =>
  !!r && (r.kind === "choice" ? r.selected.length > 0 : r.text.trim().length > 0)

const TYPE_HINT = { single: "Choose one answer", multi: "Choose every correct answer", written: "Write your answer" } as const

/* ----------------------------------------------------------------------------
 * Save status: the second question every candidate asks after "how long is left".
 * ------------------------------------------------------------------------- */
export function SyncStatus({ state, pending, lastSyncedAt, className }: { state: SyncState; pending: number; lastSyncedAt: number | null; className?: string }) {
  const map = {
    saved: { icon: CheckCircle2, text: "All answers saved", cls: "text-success-text" },
    saving: { icon: Loader2, text: "Saving", cls: "text-muted-foreground" },
    retrying: { icon: RefreshCw, text: `Weak connection, retrying${pending ? `, ${pending} waiting` : ""}`, cls: "text-warning-text" },
    offline: { icon: CloudOff, text: `Offline, ${pending} answer${pending === 1 ? "" : "s"} kept on this device`, cls: "text-warning-text" },
    error: { icon: AlertTriangle, text: "Some answers could not be saved", cls: "text-danger-text" },
  }[state]
  const Icon = map.icon
  return (
    <span
      role="status"
      aria-live="polite"
      title={lastSyncedAt ? `Last saved to the server at ${new Date(lastSyncedAt).toLocaleTimeString()}` : undefined}
      className={cn("inline-flex min-w-0 items-center gap-1.5 text-xs font-medium", map.cls, className)}
    >
      <Icon className={cn("size-3.5 shrink-0", (state === "saving" || state === "retrying") && "animate-spin")} aria-hidden />
      <span className="truncate">{map.text}</span>
    </span>
  )
}

/* ----------------------------------------------------------------------------
 * Time rail: how much of the attempt is used, from the server clock.
 * Teal while comfortable, amber in the last 5 minutes, red in the last minute.
 * ------------------------------------------------------------------------- */
export function TimeRail({ remaining, total }: { remaining: number; total: number }) {
  const used = total > 0 ? Math.min(1, Math.max(0, 1 - remaining / total)) : 1
  const tone = remaining <= 60_000 ? "bg-danger" : remaining <= 5 * 60_000 ? "bg-time" : "bg-primary"
  return (
    <div className="h-[3px] w-full bg-muted" aria-hidden>
      <div className={cn("h-full transition-[width] duration-1000 ease-linear", tone)} style={{ width: `${used * 100}%` }} />
    </div>
  )
}

/* ----------------------------------------------------------------------------
 * Question palette. Four states, each with shape AND text, never colour alone:
 *   answered: filled; opened but blank: solid outline; not visited: dashed;
 *   marked for review: corner flag. Current question: thick ring.
 * ------------------------------------------------------------------------- */
export function Palette({
  items,
  answers,
  visited,
  current,
  onJump,
  unsynced,
}: {
  items: PaperItem[]
  answers: Record<string, Entry>
  visited: Set<string>
  current: number
  onJump: (i: number) => void
  /** Items whose latest change is only on this device while sync is stalled (S-4.1). */
  unsynced?: ReadonlySet<string>
}) {
  const counts = { answered: 0, blank: 0, unseen: 0, flagged: 0 }
  for (const it of items) {
    const a = answers[it.itemId]
    if (answered(a?.response)) counts.answered++
    else if (visited.has(it.itemId)) counts.blank++
    else counts.unseen++
    if (a?.flagged) counts.flagged++
  }
  const pct = items.length ? Math.round((counts.answered / items.length) * 100) : 0

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="mb-1.5 flex items-baseline justify-between text-sm">
          <span className="font-medium">Progress</span>
          <span className="text-muted-foreground tabular-nums">
            {counts.answered} of {items.length} answered
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label="Questions answered" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <ol className="grid grid-cols-6 gap-1.5 sm:grid-cols-8 lg:grid-cols-5">
        {items.map((it, i) => {
          const a = answers[it.itemId]
          const isAnswered = answered(a?.response)
          const seen = visited.has(it.itemId)
          const flagged = !!a?.flagged
          const state = isAnswered ? "answered" : seen ? "opened, not answered" : "not visited"
          const local = !!unsynced?.has(it.itemId)
          return (
            <li key={it.itemId}>
              <button
                type="button"
                onClick={() => onJump(i)}
                aria-label={`Question ${i + 1}, ${state}${flagged ? ", marked for review" : ""}${local ? ", not yet saved to the server" : ""}`}
                aria-current={i === current ? "step" : undefined}
                className={cn(
                  "relative grid aspect-square min-h-10 w-full place-items-center rounded-md border text-sm font-medium tabular-nums transition-colors duration-150",
                  isAnswered && "border-primary bg-primary text-primary-foreground hover:bg-primary-hover",
                  !isAnswered && seen && "border-border-strong bg-surface text-foreground hover:bg-muted",
                  !isAnswered && !seen && "border-dashed border-border-strong bg-transparent text-muted-foreground hover:bg-muted",
                  i === current && "ring-2 ring-foreground ring-offset-2 ring-offset-surface"
                )}
              >
                {i + 1}
                {flagged && (
                  <span className="absolute -top-1 -right-1 grid size-4 place-items-center rounded-full bg-time text-[oklch(0.25_0.05_60)] ring-2 ring-surface" aria-hidden>
                    <Flag className="size-2.5" />
                  </span>
                )}
                {local && (
                  <span className="absolute -bottom-1 -left-1 grid size-4 place-items-center rounded-full bg-warning-soft text-warning-text ring-2 ring-surface" aria-hidden>
                    <CloudOff className="size-2.5" />
                  </span>
                )}
              </button>
            </li>
          )
        })}
      </ol>

      <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <span className="size-3.5 rounded-[4px] bg-primary" aria-hidden />
          <dt>Answered</dt>
          <dd className="ml-auto font-medium text-foreground tabular-nums">{counts.answered}</dd>
        </div>
        <div className="flex items-center gap-2">
          <span className="size-3.5 rounded-[4px] border border-border-strong bg-surface" aria-hidden />
          <dt>Opened, blank</dt>
          <dd className="ml-auto font-medium text-foreground tabular-nums">{counts.blank}</dd>
        </div>
        <div className="flex items-center gap-2">
          <span className="size-3.5 rounded-[4px] border border-dashed border-border-strong" aria-hidden />
          <dt>Not visited</dt>
          <dd className="ml-auto font-medium text-foreground tabular-nums">{counts.unseen}</dd>
        </div>
        <div className="flex items-center gap-2">
          <Flag className="size-3.5 text-time-text" aria-hidden />
          <dt>For review</dt>
          <dd className="ml-auto font-medium text-foreground tabular-nums">{counts.flagged}</dd>
        </div>
        {!!unsynced?.size && (
          <div className="col-span-2 flex items-center gap-2 text-warning-text">
            <CloudOff className="size-3.5" aria-hidden />
            <dt>On this device only</dt>
            <dd className="ml-auto font-medium tabular-nums">{unsynced.size}</dd>
          </div>
        )}
      </dl>
    </div>
  )
}

/* ----------------------------------------------------------------------------
 * One question. Options are large hit targets with letter stamps; the native
 * radio or checkbox stays in the accessibility tree.
 * ------------------------------------------------------------------------- */
export function QuestionView({
  item,
  index,
  total,
  entry,
  disabled,
  onAnswer,
  headingRef,
  unsynced,
  eliminated,
  onEliminate,
}: {
  item: PaperItem
  index: number
  total: number
  entry: Entry | undefined
  disabled: boolean
  onAnswer: (r: AnswerResponse | null) => void
  headingRef?: React.Ref<HTMLHeadingElement>
  /** Latest change is only on this device while sync is stalled (S-4.1). */
  unsynced?: boolean
  /** Options the candidate has ruled out (answer eliminator). Visual aid only, never sent to the server. */
  eliminated?: Set<string>
  onEliminate?: (optionId: string) => void
}) {
  const selected = entry?.response?.kind === "choice" ? entry.response.selected : []
  const text = entry?.response?.kind === "text" ? entry.response.text : ""
  const headingId = `q-${item.itemId}`

  return (
    <article aria-labelledby={headingId} id={`question-${index + 1}`} className="scroll-mt-28 rounded-xl border bg-surface">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b px-5 py-3 text-sm sm:px-7">
        <span className="font-medium">
          Question {index + 1} <span className="font-normal text-muted-foreground">of {total}</span>
        </span>
        <span className="text-muted-foreground">·</span>
        <span className="text-muted-foreground">
          {fmtMarks(item.marks)} mark{item.marks === 1 ? "" : "s"}
          {item.type === "multi" && item.scheme === "partial" ? ", partial credit" : ""}
        </span>
        {unsynced && (
          <span className="inline-flex items-center gap-1 rounded-full bg-warning-soft px-2 py-0.5 text-xs font-medium text-warning-text">
            <CloudOff className="size-3" aria-hidden />
            Kept on this device, not saved yet
          </span>
        )}
        <span className="ml-auto text-xs font-medium text-brand-text">{TYPE_HINT[item.type]}</span>
      </header>

      <div className="px-5 py-6 sm:px-7 sm:py-8">
        <h2 id={headingId} ref={headingRef} tabIndex={-1} className="mb-7 text-[1.08em] leading-relaxed font-medium whitespace-pre-wrap outline-none">
          {item.stem}
        </h2>

        {item.type === "written" ? (
          <div className="flex flex-col gap-2">
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
              placeholder="Type your answer here. It saves as you write."
              className="min-h-60 text-[1em] leading-relaxed"
              onChange={(e) => onAnswer(e.target.value ? { kind: "text", text: e.target.value } : null)}
            />
            <p className="text-right text-xs text-muted-foreground tabular-nums">{text.trim() ? text.trim().split(/\s+/).length : 0} words</p>
          </div>
        ) : (
          <fieldset disabled={disabled}>
            <legend className="sr-only">{TYPE_HINT[item.type]}</legend>
            <ul className="flex flex-col gap-2.5">
              {item.options.map((o, oi) => {
                const checked = selected.includes(o.id)
                const letter = String.fromCharCode(65 + oi)
                const out = !!eliminated?.has(o.id) && !checked
                return (
                  <li key={o.id} className="group/opt flex items-stretch gap-2">
                    <label
                      className={cn(
                        "flex min-h-14 flex-1 cursor-pointer items-center gap-4 rounded-lg border px-4 py-3 transition-colors duration-150 has-focus-visible:ring-2 has-focus-visible:ring-ring",
                        checked ? "border-primary bg-brand-softer" : "hover:border-border-strong hover:bg-muted/50",
                        out && "border-dashed opacity-60"
                      )}
                    >
                      <input
                        type={item.type === "single" ? "radio" : "checkbox"}
                        name={`opt-${item.itemId}`}
                        checked={checked}
                        onChange={() => {
                          const next = item.type === "single" ? [o.id] : checked ? selected.filter((x) => x !== o.id) : [...selected, o.id]
                          onAnswer(next.length ? { kind: "choice", selected: next } : null)
                        }}
                        className="sr-only"
                      />
                      <span
                        aria-hidden
                        className={cn(
                          "grid size-8 shrink-0 place-items-center border text-sm font-semibold transition-colors duration-150",
                          item.type === "single" ? "rounded-full" : "rounded-md",
                          checked ? "border-primary bg-primary text-primary-foreground" : "border-border-strong bg-surface text-muted-foreground"
                        )}
                      >
                        {letter}
                      </span>
                      <span className={cn("flex-1 leading-relaxed", out && "text-muted-foreground line-through decoration-2")}>{o.text}</span>
                    </label>
                    {onEliminate && !disabled && (
                      <button
                        type="button"
                        onClick={() => onEliminate(o.id)}
                        aria-pressed={out}
                        aria-label={out ? `Bring back option ${letter}` : `Rule out option ${letter}`}
                        title={out ? "Bring back" : "Rule out this option"}
                        className={cn(
                          "grid w-10 shrink-0 place-items-center rounded-lg border text-muted-foreground transition-opacity duration-150 hover:bg-muted hover:text-foreground focus-visible:opacity-100",
                          out ? "opacity-100" : "opacity-100 sm:opacity-0 sm:group-hover/opt:opacity-100"
                        )}
                      >
                        {out ? <Undo2 className="size-4" /> : <X className="size-4" />}
                      </button>
                    )}
                  </li>
                )
              })}
            </ul>
            {selected.length > 0 && !disabled && (
              <button type="button" onClick={() => onAnswer(null)} className="mt-3 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
                Clear my answer
              </button>
            )}
          </fieldset>
        )}
      </div>
    </article>
  )
}
