import { Check } from "lucide-react"
import { cn } from "@/lib/utils"

export type Stage = "draft" | "scheduled" | "live" | "grading" | "released"

const STEPS: { key: Stage; label: string }[] = [
  { key: "draft", label: "Draft" },
  { key: "scheduled", label: "Scheduled" },
  { key: "live", label: "Live" },
  { key: "grading", label: "Grading" },
  { key: "released", label: "Results out" },
]

export function stageOf(effective: "draft" | "published" | "ongoing" | "completed", resultsPublished: boolean): Stage {
  if (effective === "draft") return "draft"
  if (effective === "published") return "scheduled"
  if (effective === "ongoing") return "live"
  return resultsPublished ? "released" : "grading"
}

/** Where this exam is in its life. Completed steps get a check; the current step is labelled for screen readers. */
export function Lifecycle({ stage, className }: { stage: Stage; className?: string }) {
  const at = STEPS.findIndex((s) => s.key === stage)
  return (
    <ol className={cn("flex flex-wrap items-center gap-1.5 text-xs", className)} aria-label="Exam lifecycle">
      {STEPS.map((s, i) => {
        const done = i < at
        const current = i === at
        return (
          <li key={s.key} className="flex items-center gap-1.5">
            <span
              aria-current={current ? "step" : undefined}
              className={cn(
                "inline-flex h-6 items-center gap-1 rounded-full px-2.5 font-medium",
                current && (s.key === "live" ? "bg-success-soft text-success-text" : s.key === "grading" ? "bg-time-soft text-time-text" : "bg-brand-soft text-brand-text"),
                done && "text-muted-foreground",
                !done && !current && "text-subtle-foreground"
              )}
            >
              {done && <Check className="size-3" aria-hidden />}
              {current && s.key === "live" && <span className="size-1.5 animate-live rounded-full bg-success text-success" aria-hidden />}
              {s.label}
              {done && <span className="sr-only"> (done)</span>}
              {current && <span className="sr-only"> (current stage)</span>}
            </span>
            {i < STEPS.length - 1 && <span className={cn("h-px w-3 sm:w-5", i < at ? "bg-border-strong" : "bg-border")} aria-hidden />}
          </li>
        )
      })}
    </ol>
  )
}
