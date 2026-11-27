"use client"

import * as React from "react"
import Link from "next/link"
import { ArrowDown, ArrowUp, ArrowUpDown, Search } from "lucide-react"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { fmtDateTime, fmtDuration, fmtMarks } from "@/lib/format"

type Stage = "draft" | "scheduled" | "live" | "grading" | "released"
type Row = {
  id: string
  title: string
  stage: Stage
  startsAt: string
  endsAt: string
  durationMin: number
  questionCount: number
  totalMarks: number
  enrolledCount: number
  submittedCount: number
  activeCount: number
  toGradeCount: number
}

const STAGES: { key: "all" | Stage; label: string }[] = [
  { key: "all", label: "All" },
  { key: "live", label: "Live" },
  { key: "scheduled", label: "Scheduled" },
  { key: "draft", label: "Draft" },
  { key: "grading", label: "Grading" },
  { key: "released", label: "Results out" },
]
const BADGE: Record<Stage, string> = {
  draft: "bg-muted text-muted-foreground",
  scheduled: "bg-info-soft text-info-text",
  live: "bg-success-soft text-success-text",
  grading: "bg-time-soft text-time-text",
  released: "bg-brand-soft text-brand-text",
}
const LABEL: Record<Stage, string> = { draft: "Draft", scheduled: "Scheduled", live: "Live", grading: "Grading", released: "Results out" }

type SortKey = "title" | "startsAt" | "enrolledCount" | "stage"

export function ExamTable({ rows, initialStage }: { rows: Row[]; initialStage: string }) {
  const [stage, setStage] = React.useState<"all" | Stage>(STAGES.some((s) => s.key === initialStage) ? (initialStage as Stage) : "all")
  const [q, setQ] = React.useState("")
  const [sort, setSort] = React.useState<{ key: SortKey; dir: 1 | -1 }>({ key: "startsAt", dir: -1 })

  const counts = Object.fromEntries(STAGES.map((s) => [s.key, s.key === "all" ? rows.length : rows.filter((r) => r.stage === s.key).length]))
  const order: Stage[] = ["live", "scheduled", "draft", "grading", "released"]
  const shown = rows
    .filter((r) => (stage === "all" || r.stage === stage) && (!q || r.title.toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => {
      const k = sort.key
      const va = k === "stage" ? order.indexOf(a.stage) : a[k]
      const vb = k === "stage" ? order.indexOf(b.stage) : b[k]
      return (va < vb ? -1 : va > vb ? 1 : 0) * sort.dir
    })

  const th = (key: SortKey, label: string, cls?: string) => (
    <th className={cn("px-3 py-2.5 font-medium", cls)} aria-sort={sort.key === key ? (sort.dir === 1 ? "ascending" : "descending") : "none"}>
      <button
        type="button"
        onClick={() => setSort((s) => ({ key, dir: s.key === key ? ((s.dir * -1) as 1 | -1) : 1 }))}
        className="inline-flex items-center gap-1 rounded hover:text-foreground"
      >
        {label}
        {sort.key === key ? sort.dir === 1 ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" /> : <ArrowUpDown className="size-3 opacity-50" />}
      </button>
    </th>
  )

  return (
    <div className="overflow-hidden rounded-xl border bg-surface">
      <div className="flex flex-col gap-3 border-b p-3 sm:flex-row sm:items-center sm:justify-between">
        <div role="tablist" aria-label="Filter by stage" className="scrollbar-none -mx-1 flex gap-1 overflow-x-auto px-1">
          {STAGES.map((s) => (
            <button
              key={s.key}
              type="button"
              role="tab"
              aria-selected={stage === s.key}
              onClick={() => setStage(s.key)}
              className={cn(
                "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-sm transition-colors",
                stage === s.key ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {s.label}
              <span className="text-xs tabular-nums opacity-70">{counts[s.key]}</span>
            </button>
          ))}
        </div>
        <div className="relative sm:w-64">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input aria-label="Search exams" placeholder="Search by title" className="pl-8" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              {th("title", "Exam", "pl-5")}
              {th("stage", "Stage")}
              {th("startsAt", "Window")}
              {th("enrolledCount", "Candidates")}
              <th className="px-5 py-2.5 text-right font-medium">Paper</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {shown.map((r) => (
              <tr key={r.id} className="relative transition-colors hover:bg-muted/40">
                <td className="py-3 pr-3 pl-5">
                  <Link href={`/examiner/exams/${r.id}`} className="font-medium after:absolute after:inset-0 after:content-['']">
                    {r.title}
                  </Link>
                </td>
                <td className="px-3 py-3">
                  <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium", BADGE[r.stage])}>
                    {r.stage === "grading" && r.toGradeCount ? `${r.toGradeCount} to grade` : LABEL[r.stage]}
                  </span>
                </td>
                <td className="px-3 py-3 text-muted-foreground">
                  <span className="block text-foreground">{fmtDateTime(r.startsAt)}</span>
                  <span className="text-xs">{fmtDuration(r.durationMin)} per attempt</span>
                </td>
                <td className="px-3 py-3 tabular-nums">
                  {r.enrolledCount}
                  <span className="block text-xs text-muted-foreground">
                    {r.stage === "live" ? `${r.activeCount} writing, ${r.submittedCount} submitted` : r.submittedCount ? `${r.submittedCount} submitted` : "enrolled"}
                  </span>
                </td>
                <td className="px-5 py-3 text-right text-muted-foreground tabular-nums">
                  {r.questionCount} q · {fmtMarks(r.totalMarks)} marks
                </td>
              </tr>
            ))}
            {!shown.length && (
              <tr>
                <td colSpan={5} className="px-5 py-12 text-center text-muted-foreground">
                  {rows.length ? "No exams match this filter." : "No exams yet. Create one to get started."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
