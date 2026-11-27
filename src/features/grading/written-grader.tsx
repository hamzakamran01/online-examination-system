"use client"

import * as React from "react"
import { Check, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { gradeAnswerSchema } from "@/lib/validation/grading"
import { gradeAnswerAction } from "./actions"

/** Marks entry for one written answer (C-3.7.2): validated 0..max on the client and again on the server. */
export function WrittenGrader({
  examId,
  attemptId,
  itemId,
  max,
  initialMarks,
  initialFeedback,
  published,
}: {
  examId: string
  attemptId: string
  itemId: string
  max: number
  initialMarks: number | null
  initialFeedback: string
  published: boolean
}) {
  const router = useRouter()
  const [marks, setMarks] = React.useState(initialMarks === null ? "" : String(initialMarks))
  const [feedback, setFeedback] = React.useState(initialFeedback)
  const [reason, setReason] = React.useState("")
  const [errors, setErrors] = React.useState<Record<string, string>>({})
  const [saving, setSaving] = React.useState(false)
  const id = `g-${itemId}`
  const dirty = marks !== (initialMarks === null ? "" : String(initialMarks)) || feedback !== initialFeedback

  const save = async () => {
    const next: Record<string, string> = {}
    const parsed = gradeAnswerSchema.safeParse({ attemptId, itemId, marks, feedback, reason })
    if (!parsed.success) for (const i of parsed.error.issues) next[String(i.path[0])] ??= i.message
    if (marks === "") next.marks = "Enter a mark."
    else if (Number(marks) > max) next.marks = `Maximum is ${max}.`
    if (published && reason.trim().length < 5) next.reason = "Explain why the mark changes (at least 5 characters)."
    setErrors(next)
    if (Object.keys(next).length) return
    setSaving(true)
    try {
      const r = await gradeAnswerAction(examId, { attemptId, itemId, marks: Number(marks), feedback, reason })
      if (r.ok) {
        toast.success(published ? "Regrade saved and recorded." : "Mark saved. Total updated.")
        setReason("")
        router.refresh()
      } else {
        setErrors(r.fields ?? {})
        toast.error(r.message)
      }
    } catch {
      toast.error("Could not save. Check your connection and try again.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="grid gap-3 sm:grid-cols-[140px_1fr]">
        <div className="space-y-1">
          <label htmlFor={`${id}-marks`} className="text-sm font-medium">
            Marks (0 to {max})
          </label>
          <Input
            id={`${id}-marks`}
            type="number"
            inputMode="decimal"
            min={0}
            max={max}
            step={0.5}
            value={marks}
            onChange={(e) => setMarks(e.target.value)}
            aria-invalid={!!errors.marks}
            aria-describedby={errors.marks ? `${id}-marks-err` : undefined}
            className="tabular-nums"
          />
          {errors.marks && (
            <p id={`${id}-marks-err`} role="alert" className="text-xs text-destructive">
              {errors.marks}
            </p>
          )}
        </div>
        <div className="space-y-1">
          <label htmlFor={`${id}-fb`} className="text-sm font-medium">
            Feedback for the candidate (optional)
          </label>
          <Textarea id={`${id}-fb`} rows={2} value={feedback} onChange={(e) => setFeedback(e.target.value)} maxLength={2000} />
        </div>
      </div>
      {published && (
        <div className="space-y-1">
          <label htmlFor={`${id}-reason`} className="text-sm font-medium">
            Reason for regrade (required after publication)
          </label>
          <Input
            id={`${id}-reason`}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            aria-invalid={!!errors.reason}
            aria-describedby={errors.reason ? `${id}-reason-err` : undefined}
            placeholder="e.g. Rubric point 2 was overlooked"
          />
          {errors.reason && (
            <p id={`${id}-reason-err`} role="alert" className="text-xs text-destructive">
              {errors.reason}
            </p>
          )}
        </div>
      )}
      <div className="flex justify-end">
        <Button size="sm" onClick={save} disabled={saving || !dirty}>
          {saving ? <Loader2 className="animate-spin" aria-hidden /> : <Check />}
          {initialMarks === null ? "Save mark" : "Update mark"}
        </Button>
      </div>
    </div>
  )
}
