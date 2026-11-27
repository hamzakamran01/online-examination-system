"use client"

import * as React from "react"
import { Check, CloudOff, RefreshCw, ShieldCheck } from "lucide-react"
import { cn } from "@/lib/utils"

const steps = [
  {
    label: "Answer captured",
    icon: Check,
    title: "The answer is recorded first.",
    body: "Changes are journaled on the candidate's device before synchronization. The interface makes the save state visible.",
    status: "Saved on this device",
  },
  {
    label: "Connection lost",
    icon: CloudOff,
    title: "A dropped connection is not a lost answer.",
    body: "The candidate sees that the connection is unavailable while pending work stays in the local answer journal.",
    status: "Offline · answers queued",
  },
  {
    label: "Sync restored",
    icon: RefreshCw,
    title: "Synchronization resumes when the network returns.",
    body: "Queued answers are sent again. The server deadline remains authoritative, so reconnecting does not create extra exam time.",
    status: "Syncing · server time unchanged",
  },
  {
    label: "Evidence reviewed",
    icon: ShieldCheck,
    title: "Examiners see evidence, not accusations.",
    body: "Server-measured gaps and browser-reported signals give context for a fair review. Signals alone never establish misconduct.",
    status: "Available to examiner review",
  },
]

export function RecoveryDemo() {
  const [active, setActive] = React.useState(0)
  const current = steps[active]
  const ActiveIcon = current.icon

  return (
    <div className="recovery-demo">
      <div className="recovery-steps" role="group" aria-label="Explore the outage recovery workflow">
        {steps.map((step, index) => {
          const Icon = step.icon
          const selected = index === active
          return (
            <button
              key={step.label}
              type="button"
              aria-pressed={selected}
              onClick={() => setActive(index)}
              className={cn("recovery-step", selected && "recovery-step-active")}
            >
              <span className="recovery-step-icon"><Icon className="size-4" aria-hidden /></span>
              <span className="min-w-0">
                <span className="block text-[0.65rem] text-muted-foreground">0{index + 1}</span>
                <span className="mt-0.5 block truncate text-xs font-semibold">{step.label}</span>
              </span>
              {index < steps.length - 1 && <span className="recovery-connector" aria-hidden />}
            </button>
          )
        })}
      </div>
      <div className="recovery-detail" aria-live="polite">
        <div className="recovery-detail-icon"><ActiveIcon className="size-5" aria-hidden /></div>
        <div className="min-w-0">
          <h3 className="font-display text-xl font-semibold tracking-tight text-foreground">{current.title}</h3>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">{current.body}</p>
          <div className="mt-5 inline-flex items-center gap-2 rounded-full border bg-surface px-3 py-1.5 text-xs font-medium text-foreground">
            <span className="size-1.5 rounded-full bg-primary" aria-hidden />
            {current.status}
          </div>
        </div>
      </div>
    </div>
  )
}
