"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Loader2, PlayCircle } from "lucide-react"
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
  if (access === "upcoming") return <p className="text-sm text-muted-foreground">The start button appears here when the window opens.</p>
  if (access === "submitted") return <p className="text-sm text-muted-foreground">You have already submitted this exam.</p>
  if (access === "closed") return <p className="text-sm text-muted-foreground">This exam is closed.</p>

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
