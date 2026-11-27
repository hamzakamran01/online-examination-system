"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { CheckCircle2, Hourglass, Loader2, Lock, PlayCircle } from "lucide-react"
import { toast } from "sonner"
import { Button, buttonVariants } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { ConfirmAction } from "@/components/shell/common"
import { startAttemptAction } from "./actions"

export function StartExam({
  examId,
  access,
  attemptId,
  minutes,
  fullMinutes,
}: {
  examId: string
  access: "open" | "resume" | "upcoming" | "submitted" | "closed"
  attemptId?: string
  minutes: number
  fullMinutes: number
}) {
  const router = useRouter()
  const [agreed, setAgreed] = React.useState(false)
  const [starting, setStarting] = React.useState(false)

  if (access === "resume" && attemptId)
    return (
      <Link href={`/attempt/${attemptId}`} className={buttonVariants({ size: "lg" })}>
        <PlayCircle />
        Resume exam
      </Link>
    )
  if (access === "upcoming" || access === "submitted" || access === "closed") {
    const c = {
      upcoming: { icon: Hourglass, title: "Not open yet", body: "The start button appears here when the window opens.", tone: "bg-time-soft text-time-text" },
      submitted: { icon: CheckCircle2, title: "Submitted", body: "You have already submitted this exam.", tone: "bg-success-soft text-success-text" },
      closed: { icon: Lock, title: "Closed", body: "This exam window has ended.", tone: "bg-muted text-muted-foreground" },
    }[access]
    return (
      <div role="status" className="flex gap-3 rounded-xl border border-dashed bg-surface-sunken/60 p-4">
        <span className={`grid size-8 shrink-0 place-items-center rounded-lg ${c.tone}`}>
          <c.icon className="size-4" aria-hidden />
        </span>
        <p className="text-sm">
          <span className="block font-medium">{c.title}</span>
          <span className="text-muted-foreground">{c.body}</span>
        </p>
      </div>
    )
  }

  const start = async () => {
    setStarting(true)
    try {
      const r = await startAttemptAction(examId)
      if (r.ok) router.push(`/attempt/${r.data.attemptId}`)
      else {
        toast.error(r.message)
        router.refresh()
      }
    } catch {
      toast.error("Could not start. Check your connection and try again.")
    } finally {
      setStarting(false)
    }
  }

  return (
    <div className="space-y-4 rounded-xl border bg-card p-5 shadow-panel">
      <label className="flex items-start gap-3 text-sm">
        <Checkbox checked={agreed} onCheckedChange={(v) => setAgreed(Boolean(v))} className="mt-0.5" />
        <span>I have read the instructions. I understand the timer starts immediately and cannot be paused.</span>
      </label>
      {minutes < fullMinutes && (
        <p className="rounded-lg bg-warning-soft p-3 text-sm text-warning-text">
          The window closes soon, so you will have about {minutes} minutes instead of {fullMinutes}.
        </p>
      )}
      <ConfirmAction
        title="Start the exam now?"
        description={`Your ${Math.min(minutes, fullMinutes)} minute timer starts on the server as soon as you continue.`}
        confirmLabel="Start now"
        onConfirm={start}
        trigger={(open) => (
          <Button size="lg" disabled={!agreed || starting} onClick={open}>
            {starting ? <Loader2 className="animate-spin" aria-hidden /> : <PlayCircle />}
            Start exam
          </Button>
        )}
      />
    </div>
  )
}
