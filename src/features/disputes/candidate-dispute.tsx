"use client"

/**
 * Candidate dispute controls (I-5.4): raise a dispute on one question of a published
 * result, follow its decision on a timeline, withdraw it while it is open.
 */
import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { CircleCheck, CircleDot, Flag, Loader2, Undo2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { fmtDateTime, fmtMarks } from "@/lib/format"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field"
import { ConfirmAction, useAction } from "@/components/shell/common"
import {
  DISPUTE_STATUS_LABEL,
  DISPUTE_TYPES,
  DISPUTE_TYPE_HELP,
  DISPUTE_TYPE_LABEL,
  type DisputeStatus,
} from "@/lib/domain/disputes"
import { raiseDisputeSchema, type RaiseDisputeInput } from "@/lib/validation/disputes"
import type { CandidateDispute } from "@/server/services/disputes"
import { raiseDisputeAction, withdrawDisputeAction } from "./actions"

export function RaiseDisputeButton({ attemptId, itemId, questionNo }: { attemptId: string; itemId: string; questionNo: number }) {
  const [open, setOpen] = React.useState(false)
  const { run, pending } = useAction()
  const form = useForm<RaiseDisputeInput>({
    resolver: zodResolver(raiseDisputeSchema),
    defaultValues: { attemptId, itemId, type: undefined, statement: "" },
  })
  const e = form.formState.errors
  const statement = form.watch("statement") ?? ""
  const type = form.watch("type")

  return (
    <>
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)} aria-label={`Raise a dispute on question ${questionNo}`}>
        <Flag />
        Question this mark
      </Button>
      <Dialog open={open} onOpenChange={(o) => !pending && setOpen(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Raise a dispute on question {questionNo}</DialogTitle>
            <DialogDescription>
              Your examiner reviews the question as you saw it, your answer, the marking guide and the exam record, then explains
              the decision. You can raise one dispute per question.
            </DialogDescription>
          </DialogHeader>
          <form
            noValidate
            onSubmit={form.handleSubmit(async (values) => {
              const r = await run(() => raiseDisputeAction(values))
              if (r.ok) {
                setOpen(false)
                form.reset({ attemptId, itemId, type: undefined, statement: "" })
              } else if ("fields" in r && r.fields)
                for (const [k, m] of Object.entries(r.fields)) form.setError(k as keyof RaiseDisputeInput, { message: m })
            })}
          >
            <FieldGroup>
              <FieldSet data-invalid={!!e.type}>
                <FieldLegend variant="label">What kind of problem is it?</FieldLegend>
                <div className="grid gap-2">
                  {DISPUTE_TYPES.map((t) => (
                    <label
                      key={t}
                      className={cn(
                        "flex cursor-pointer gap-3 rounded-lg border p-3 text-sm transition-colors hover:bg-muted/50 has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50",
                        type === t && "border-primary bg-brand-softer"
                      )}
                    >
                      <input type="radio" value={t} className="mt-1 accent-[var(--color-primary)]" {...form.register("type")} />
                      <span>
                        <span className="block font-medium">{DISPUTE_TYPE_LABEL[t]}</span>
                        <span className="text-muted-foreground">{DISPUTE_TYPE_HELP[t]}</span>
                      </span>
                    </label>
                  ))}
                </div>
                <FieldError errors={[e.type]} />
              </FieldSet>
              <Field data-invalid={!!e.statement}>
                <FieldLabel htmlFor={`d-${itemId}`}>Explain what is wrong</FieldLabel>
                <Textarea id={`d-${itemId}`} rows={4} maxLength={1000} aria-invalid={!!e.statement} {...form.register("statement")} />
                <FieldDescription>
                  Be specific: which part of your answer, or which wording, and why. {statement.trim().length} / 1,000
                </FieldDescription>
                <FieldError errors={[e.statement]} />
              </Field>
            </FieldGroup>
            <DialogFooter className="mt-6">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending && <Loader2 className="animate-spin" aria-hidden />}
                Send dispute
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}

const TONE: Record<DisputeStatus, "warning" | "success" | "muted" | "secondary"> = {
  open: "warning",
  regraded: "success",
  voided: "success",
  rejected: "secondary",
  withdrawn: "muted",
}

/** Timeline of one dispute, as the candidate sees it. */
export function DisputeThread({ attemptId, d }: { attemptId: string; d: CandidateDispute }) {
  const { run, pending } = useAction()
  const decided = d.status !== "open" && d.status !== "withdrawn"
  const changed = decided && d.marksBefore !== null && d.marksAfter !== null && d.marksBefore !== d.marksAfter
  return (
    <div className="mt-3 rounded-lg border p-3 text-sm" aria-label="Dispute">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Badge variant={TONE[d.status]}>{DISPUTE_STATUS_LABEL[d.status]}</Badge>
        <span className="text-xs text-muted-foreground">{DISPUTE_TYPE_LABEL[d.type]}</span>
        {d.status === "open" && (
          <span className="ml-auto">
            <ConfirmAction
              trigger={(open) => (
                <Button size="sm" variant="ghost" disabled={pending} onClick={open}>
                  <Undo2 />
                  Withdraw
                </Button>
              )}
              title="Withdraw this dispute?"
              description="Withdrawing is final: you cannot raise a dispute on this question again."
              confirmLabel="Withdraw"
              onConfirm={() => run(() => withdrawDisputeAction(attemptId, d.id))}
            />
          </span>
        )}
      </div>
      <ol className="relative space-y-3 border-l pl-4">
        <li className="relative">
          <CircleDot className="absolute top-0.5 -left-[1.4rem] size-3.5 bg-card text-muted-foreground" aria-hidden />
          <p className="font-medium">You raised a dispute</p>
          <p className="text-xs text-muted-foreground">{fmtDateTime(d.createdAt)}</p>
          <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{d.statement}</p>
        </li>
        {d.status === "open" && (
          <li className="relative">
            <CircleDot className="absolute top-0.5 -left-[1.4rem] size-3.5 bg-card text-warning-text" aria-hidden />
            <p className="font-medium">Waiting for your examiner</p>
            <p className="text-xs text-muted-foreground">You will see the decision and the reason here.</p>
          </li>
        )}
        {(decided || d.status === "withdrawn") && (
          <li className="relative">
            <CircleCheck className={cn("absolute top-0.5 -left-[1.4rem] size-3.5 bg-card", decided ? "text-success-text" : "text-muted-foreground")} aria-hidden />
            <p className="font-medium">{d.status === "withdrawn" ? "You withdrew the dispute" : "Decision"}</p>
            {d.resolvedAt && <p className="text-xs text-muted-foreground">{fmtDateTime(d.resolvedAt)}</p>}
            {changed && (
              <p className="mt-1 font-medium tabular-nums">
                Marks for this question: {fmtMarks(d.marksBefore)} to {fmtMarks(d.marksAfter)}
              </p>
            )}
            {d.status === "voided" && (
              <p className="mt-1 text-muted-foreground">The same rule was applied to every candidate who sat this question.</p>
            )}
            {d.resolutionNote && <p className="mt-1 whitespace-pre-wrap">{d.resolutionNote}</p>}
          </li>
        )}
      </ol>
    </div>
  )
}
