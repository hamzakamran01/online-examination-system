"use client"

import * as React from "react"
import Link from "next/link"
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { ArrowUpRight, ChevronDown, Clock, FileDown, Hourglass } from "lucide-react"
import { cn } from "@/lib/utils"
import { fmtDate, fmtMarks } from "@/lib/format"
import type { Transcript } from "@/server/services/candidate-results"

type Entry = Transcript["entries"][number]

const TYPE_LABEL = { single: "Single answer", multi: "Multiple select", written: "Written" } as const

/** Share of marks earned on one question, as a fill level. Text labels carry the exact value. */
function cellTone(marks: number, max: number) {
  const r = max ? marks / max : 0
  if (r >= 1) return "bg-success"
  if (r >= 0.5) return "bg-success/55"
  if (r > 0) return "bg-time"
  return "bg-danger/70"
}

/** One square per question: the shape of the paper at a glance. */
export function HeatStrip({ cells, size = "md" }: { cells: Entry["cells"]; size?: "sm" | "md" }) {
  return (
    <ol className={cn("flex flex-wrap", size === "sm" ? "gap-[3px]" : "gap-1")} aria-label="Marks per question">
      {cells.map((c) => (
        <li
          key={c.index}
          title={`Question ${c.index + 1}: ${fmtMarks(c.marks)} of ${fmtMarks(c.max)}${c.answered ? "" : " (not answered)"}`}
          className={cn(
            "rounded-[3px]",
            size === "sm" ? "size-2.5" : "size-4",
            c.answered ? cellTone(c.marks, c.max) : "border border-dashed border-border-strong bg-transparent"
          )}
        >
          <span className="sr-only">{`Question ${c.index + 1}: ${fmtMarks(c.marks)} of ${fmtMarks(c.max)}${c.answered ? "" : ", not answered"}`}</span>
        </li>
      ))}
    </ol>
  )
}

export function TrendChart({ points }: { points: Transcript["trend"] }) {
  const data = points.map((p, i) => ({ i: i + 1, label: p.title, percent: p.percent }))
  return (
    <figure>
      <div className="h-48" aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -24 }}>
            <defs>
              <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.28} />
                <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
            <XAxis dataKey="i" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickFormatter={(v) => `#${v}`} />
            <YAxis domain={[0, 100]} ticks={[0, 50, 100]} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
            <Tooltip
              contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
              labelFormatter={(_, p) => (p?.[0]?.payload as { label?: string })?.label ?? ""}
              formatter={(v) => [`${v}%`, "Score"]}
            />
            <Area type="monotone" dataKey="percent" stroke="var(--chart-1)" strokeWidth={2.5} fill="url(#trendFill)" dot={{ r: 3.5, fill: "var(--surface)", strokeWidth: 2 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="sr-only">Score trend: {points.map((p) => `${p.title} ${p.percent}%`).join(", ")}</figcaption>
    </figure>
  )
}

function Bar({ label, percent, detail }: { label: string; percent: number; detail: string }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="truncate">{label}</span>
        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
          {detail} · <span className="font-medium text-foreground">{percent}%</span>
        </span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
        <div className={cn("h-full rounded-full", percent >= 70 ? "bg-success" : percent >= 50 ? "bg-primary" : "bg-time")} style={{ width: `${percent}%` }} />
      </div>
    </div>
  )
}

function AttemptRow({ e, defaultOpen }: { e: Entry; defaultOpen: boolean }) {
  const [open, setOpen] = React.useState(defaultOpen)
  const id = `attempt-${e.attemptId}`
  const day = e.submittedAt ? new Date(e.submittedAt) : null

  return (
    <li className="relative pl-10 sm:pl-14">
      {/* timeline node */}
      <span
        aria-hidden
        className={cn(
          "absolute top-5 left-[11px] grid size-[18px] place-items-center rounded-full border-2 bg-surface sm:left-[19px]",
          !e.published ? "border-border-strong" : e.percent! >= 70 ? "border-success" : e.percent! >= 50 ? "border-primary" : "border-time"
        )}
      >
        <span className={cn("size-1.5 rounded-full", !e.published ? "bg-border-strong" : e.percent! >= 70 ? "bg-success" : e.percent! >= 50 ? "bg-primary" : "bg-time")} />
      </span>

      <div className="overflow-hidden rounded-xl border bg-surface">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls={id}
          disabled={!e.published}
          className="flex w-full items-center gap-4 px-4 py-4 text-left transition-colors enabled:hover:bg-muted/40 sm:px-5"
        >
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground">{day ? fmtDate(day) : "Submitted"}</p>
            <p className="mt-0.5 truncate font-medium">{e.title}</p>
            <div className="mt-2.5">
              {e.published ? (
                <HeatStrip cells={e.cells} size="sm" />
              ) : (
                <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Hourglass className="size-3.5" aria-hidden />
                  Awaiting results. Your examiner has not published marks yet.
                </p>
              )}
            </div>
          </div>
          {e.published && (
            <div className="shrink-0 text-right">
              <p className="font-display text-2xl leading-none font-semibold tabular-nums">{e.percent}%</p>
              <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                {fmtMarks(e.score)} / {fmtMarks(e.maxMarks)}
              </p>
              {e.passed !== null && (
                <p className={cn("mt-1 text-xs font-medium", e.passed ? "text-success-text" : "text-danger-text")}>{e.passed ? "Passed" : "Below pass mark"}</p>
              )}
            </div>
          )}
          {e.published && <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform duration-200", open && "rotate-180")} aria-hidden />}
        </button>

        {e.published && open && (
          <div id={id} className="grid gap-6 border-t bg-surface-sunken/60 px-4 py-5 sm:px-5 md:grid-cols-2">
            <div>
              <p className="mb-3 text-xs font-medium text-muted-foreground">Marks per question</p>
              <HeatStrip cells={e.cells} />
              <dl className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-[2px] bg-success" aria-hidden />
                  <dt>Full marks</dt>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-[2px] bg-time" aria-hidden />
                  <dt>Partial</dt>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-[2px] bg-danger/70" aria-hidden />
                  <dt>No marks</dt>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-[2px] border border-dashed border-border-strong" aria-hidden />
                  <dt>Not answered</dt>
                </div>
              </dl>
              <p className="mt-5 mb-3 text-xs font-medium text-muted-foreground">By question type</p>
              <div className="flex flex-col gap-3">
                {e.types.map((t) => (
                  <Bar key={t.key} label={TYPE_LABEL[t.key as keyof typeof TYPE_LABEL]} percent={t.percent} detail={`${fmtMarks(t.earned)} / ${fmtMarks(t.max)}`} />
                ))}
              </div>
            </div>
            <div>
              <p className="mb-3 text-xs font-medium text-muted-foreground">By topic</p>
              <div className="flex flex-col gap-3">
                {e.topics.map((t) => (
                  <Bar key={t.key} label={t.key} percent={t.percent} detail={`${t.n} q`} />
                ))}
              </div>
              {e.topics.length > 1 && (
                <p className="mt-4 rounded-lg bg-surface px-3 py-2.5 text-sm">
                  <span className="font-medium text-success-text">Strongest:</span> {e.topics[0].key}.{" "}
                  <span className="font-medium text-time-text">Focus next on:</span> {e.topics.at(-1)!.key}.
                </p>
              )}
              <div className="mt-5 flex flex-wrap gap-2">
                <Link
                  href={`/candidate/results/${e.attemptId}`}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary-hover"
                >
                  Full result and feedback
                  <ArrowUpRight className="size-4" aria-hidden />
                </Link>
                <a
                  href={`/api/reports/attempt/${e.attemptId}`}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium hover:bg-muted"
                >
                  <FileDown className="size-4" aria-hidden />
                  Verifiable PDF
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
    </li>
  )
}

export function ResultsTimeline({ entries }: { entries: Entry[] }) {
  const [filter, setFilter] = React.useState<"all" | "published" | "awaiting">("all")
  const shown = entries.filter((e) => (filter === "all" ? true : filter === "published" ? e.published : !e.published))
  const firstPublished = entries.find((e) => e.published)?.attemptId
  return (
    <section aria-labelledby="timeline-h">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 id="timeline-h" className="flex items-center gap-2 text-base font-semibold">
          <Clock className="size-4 text-muted-foreground" aria-hidden />
          Every attempt
        </h2>
        <div role="tablist" aria-label="Filter attempts" className="flex gap-1">
          {(
            [
              ["all", "All", entries.length],
              ["published", "Published", entries.filter((e) => e.published).length],
              ["awaiting", "Awaiting", entries.filter((e) => !e.published).length],
            ] as const
          ).map(([k, l, n]) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={filter === k}
              onClick={() => setFilter(k)}
              className={cn("inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-sm transition-colors", filter === k ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted")}
            >
              {l}
              <span className="text-xs tabular-nums opacity-70">{n}</span>
            </button>
          ))}
        </div>
      </div>
      {shown.length ? (
        <ol className="relative flex flex-col gap-3 before:absolute before:top-2 before:bottom-2 before:left-[19px] before:w-px before:bg-border sm:before:left-[27px]">
          {shown.map((e) => (
            <AttemptRow key={e.attemptId} e={e} defaultOpen={e.attemptId === firstPublished} />
          ))}
        </ol>
      ) : (
        <p className="rounded-xl border bg-surface px-5 py-10 text-center text-sm text-muted-foreground">Nothing here yet.</p>
      )}
    </section>
  )
}

