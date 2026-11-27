"use client"

import * as React from "react"
import { Check, CircleHelp, Clock3, FileCheck2, Signal, WifiOff } from "lucide-react"
import { cn } from "@/lib/utils"

type PreviewMode = "monitor" | "candidate"

const monitorFrames = [
  {
    writing: 18,
    reconnecting: 1,
    candidates: [
      { initials: "AK", name: "Ayesha Khan", detail: "Question 18 of 24", state: "Writing", tone: "text-success-text bg-success-soft", progress: 75 },
      { initials: "BH", name: "Bilal Ahmed", detail: "Question 15 of 24", state: "Reconnected", tone: "text-info-text bg-info-soft", progress: 62 },
      { initials: "SR", name: "Sara Rauf", detail: "Submitted at 10:42", state: "Submitted", tone: "text-muted-foreground bg-muted", progress: 100 },
    ],
  },
  {
    writing: 19,
    reconnecting: 0,
    candidates: [
      { initials: "AK", name: "Ayesha Khan", detail: "Question 19 of 24", state: "Writing", tone: "text-success-text bg-success-soft", progress: 79 },
      { initials: "BH", name: "Bilal Ahmed", detail: "Question 16 of 24", state: "Writing", tone: "text-success-text bg-success-soft", progress: 66 },
      { initials: "SR", name: "Sara Rauf", detail: "Submitted at 10:42", state: "Submitted", tone: "text-muted-foreground bg-muted", progress: 100 },
    ],
  },
  {
    writing: 18,
    reconnecting: 1,
    candidates: [
      { initials: "AK", name: "Ayesha Khan", detail: "Question 20 of 24", state: "Writing", tone: "text-success-text bg-success-soft", progress: 83 },
      { initials: "BH", name: "Bilal Ahmed", detail: "Connection restored", state: "Reconnecting", tone: "text-info-text bg-info-soft", progress: 66 },
      { initials: "SR", name: "Sara Rauf", detail: "Submitted at 10:42", state: "Submitted", tone: "text-muted-foreground bg-muted", progress: 100 },
    ],
  },
]

export function ProductPreview() {
  const [mode, setMode] = React.useState<PreviewMode>("monitor")
  const [monitorFrame, setMonitorFrame] = React.useState(0)
  const [secondsRemaining, setSecondsRemaining] = React.useState(31)

  React.useEffect(() => {
    const timer = window.setInterval(() => {
      setSecondsRemaining((remaining) => (remaining <= 1 ? 40 : remaining - 1))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [])

  React.useEffect(() => {
    const timer = window.setInterval(() => {
      setMonitorFrame((frame) => (frame + 1) % monitorFrames.length)
    }, 4200)
    return () => window.clearInterval(timer)
  }, [])

  const currentMonitorFrame = monitorFrames[monitorFrame]
  const formattedTime = `00:${String(secondsRemaining).padStart(2, "0")}`

  return (
    <section className="preview-shell animate-soft-rise" aria-label="Interactive product preview">
      <div className="preview-topbar">
        <div className="flex items-center gap-2">
          <span className="grid size-7 place-items-center rounded-lg bg-sidebar-accent text-sidebar-primary">
            <FileCheck2 className="size-4" aria-hidden />
          </span>
          <span className="text-sm font-semibold text-sidebar-foreground">ExamVault</span>
        </div>
        <span className="rounded-full border border-sidebar-border px-2.5 py-1 text-[0.65rem] font-medium text-sidebar-foreground/70">
          SAMPLE WORKSPACE
        </span>
      </div>

      <div className="preview-body">
        <div className="preview-heading">
          <div className="min-w-0">
            <p className="eyebrow text-muted-foreground">Web engineering · 27 Nov</p>
            <h2 className="mt-1 truncate font-display text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
              Midterm examination
            </h2>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-success/20 bg-success-soft px-2.5 py-1 text-xs font-medium text-success-text">
            <span className="size-1.5 animate-live rounded-full bg-success" aria-hidden />
            In progress
          </span>
        </div>

        <div className="preview-mode" role="group" aria-label="Choose a product preview">
          {([
            ["monitor", "Examiner monitor"],
            ["candidate", "Candidate workspace"],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={mode === value}
              onClick={() => setMode(value)}
              className={cn("preview-mode-button", mode === value && "preview-mode-button-active")}
            >
              {label}
            </button>
          ))}
        </div>

        {mode === "monitor" ? (
          <div className="preview-monitor animate-preview-change">
            <div className="preview-summary">
              <div>
                <span className="preview-summary-number">24</span>
                <span className="preview-summary-label"> enrolled</span>
              </div>
              <div>
                <span className="preview-summary-number">{currentMonitorFrame.writing}</span>
                <span className="preview-summary-label"> writing</span>
              </div>
              <div className="flex items-center gap-1.5">
                <WifiOff className="size-3.5 text-time-text" aria-hidden />
                <span className="preview-summary-number">{currentMonitorFrame.reconnecting}</span>
                <span className="preview-summary-label"> reconnecting</span>
              </div>
            </div>

            <div className="preview-table" aria-label="Illustrative candidate monitor" aria-live="off">
              <div className="preview-table-head">
                <span>Candidate</span>
                <span>Progress</span>
                <span>State</span>
              </div>
              {currentMonitorFrame.candidates.map((candidate) => (
                <div className="preview-table-row" key={candidate.initials}>
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand-soft text-[0.6rem] font-semibold text-brand-text">
                      {candidate.initials}
                    </span>
                    <span className="truncate text-xs font-medium text-foreground">{candidate.name}</span>
                  </span>
                  <span className="min-w-0 text-xs tabular-nums text-muted-foreground">
                    {candidate.detail}
                    <span className="preview-progress-track" aria-hidden>
                      <span className="preview-progress-fill" style={{ width: `${candidate.progress}%` }} />
                    </span>
                  </span>
                  <span className={cn("w-fit rounded-full px-2 py-1 text-[0.65rem] font-medium", candidate.tone)}>
                    {candidate.state}
                  </span>
                </div>
              ))}
            </div>

            <div className="preview-note">
              <Signal className="size-4 shrink-0 text-brand-text" aria-hidden />
              <span>Connection events are context for review, never a verdict.</span>
              <CircleHelp className="ml-auto size-4 shrink-0 text-muted-foreground" aria-hidden />
            </div>
          </div>
        ) : (
          <div className="preview-candidate animate-preview-change">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Question 08 <span className="px-1 text-border-strong">/</span> 24</p>
                <p className="mt-1 text-sm font-semibold text-foreground">Which status code indicates a resource was not found?</p>
              </div>
              <div
                className="preview-countdown flex shrink-0 items-center gap-1.5 rounded-lg border bg-surface px-2.5 py-2 font-mono text-xs font-semibold tabular-nums text-foreground"
                role="timer"
                aria-live="off"
                aria-label={`Illustrative question timer: ${formattedTime} remaining`}
              >
                <Clock3 className="size-3.5 text-time-text" aria-hidden />
                {formattedTime}
              </div>
            </div>
            <div className="preview-timer-track" aria-hidden>
              <span style={{ width: `${(secondsRemaining / 40) * 100}%` }} />
            </div>
            <div className="mt-4 flex flex-col gap-2">
              {["200 OK", "404 Not Found", "503 Service Unavailable"].map((option, index) => (
                <div key={option} className={cn("flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-xs", index === 1 ? "border-brand/30 bg-brand-softer text-foreground" : "bg-surface text-muted-foreground")}>
                  <span className={cn("grid size-4 place-items-center rounded-full border", index === 1 ? "border-primary bg-primary text-primary-foreground" : "border-border-strong")}>
                    {index === 1 && <Check className="size-3" aria-hidden />}
                  </span>
                  {option}
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center justify-between border-t pt-3">
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-success-text">
                <Check className="size-3.5" aria-hidden />
                Saved on this device
              </span>
              <span className="text-[0.65rem] text-muted-foreground">Illustrative question · demo timer</span>
            </div>
          </div>
        )}
      </div>
      <p className="preview-caption">A product preview using fictional sample data</p>
    </section>
  )
}
