"use client"

/**
 * Dispute decision (I-5.4). Three outcomes, each with a written explanation the
 * candidate reads. Voiding is confirmed separately because it changes every paper.
 */
import * as React from "react"
import { useRouter } from "next/navigation"
import { Ban, Check, Loader2, PenLine, X } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { fmtMarks } from "@/lib/format"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field"
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { VOID_POLICY_LABEL, type VoidPolicy } from "@/lib/domain/disputes"
import { resolveDisputeSchema } from "@/lib/validation/disputes"
import { resolveDisputeAction } from "./actions"

type Outcome = "reject" | "regrade" | "void"

const OUTCOMES: { key: Outcome; label: string; help: string; icon: React.ElementType }[] = [
  { key: "reject", label: "Reject", help: "The mark stands. Explain why.", icon: X },
  { key: "regrade", label: "Regrade this candidate", help: "Change this candidate's mark. Totals recalculate and the old report code is replaced.", icon: PenLine },
  { key: "void", label: "Void for everyone", help: "The question is flawed. One rule is applied to every candidate who sat it.", icon: Ban },
]

export function ResolveForm({
  examId,
  disputeId,
  max,
  current,
  cohort,
}: {
  examId: string
  disputeId: string
  max: number
  current: number | null
  cohort: number
}) {
  const router = useRouter()
  const [outcome, setOutcome] = React.useState<Outcome | null>(null)
  const [marks, setMarks] = React.useState("")
  const [policy, setPolicy] = React.useState<VoidPolicy | null>(null)
  const [note, setNote] = React.useState("")
  const [errors, setErrors] = React.useState<Record<string, string>>({})
  const [busy, setBusy] = React.useState(false)
  const [confirmVoid, setConfirmVoid] = React.useState(false)

  const payload = () =>
    outcome === "regrade"
      ? { disputeId, outcome, marks, note }
      : outcome === "void"
        ? { disputeId, outcome, policy: policy ?? undefined, note }
        : { disputeId, outcome: "reject" as const, note }

  const validate = () => {
    const next: Record<string, string> = {}
    if (!outcome) next.outcome = "Choose a decision."
    const parsed = resolveDisputeSchema.safeParse(payload())
    if (!parsed.success) for (const i of parsed.error.issues) next[String(i.path[0])] ??= i.message
    if (outcome === "regrade" && marks !== "" && Number(marks) > max) next.marks = `Maximum is ${fmtMarks(max)}.`
    if (outcome === "regrade" && marks !== "" && current !== null && Number(marks) === current)
      next.marks = "That is the current mark. Choose Reject to keep it."
    if (outcome) delete next.outcome
    setErrors(next)
    return Object.keys(next).length === 0 && !!outcome
  }

  const submit = async () => {
    setBusy(true)
    try {
      const r = await resolveDisputeAction(examId, payload() as Parameters<typeof resolveDisputeAction>[1])
      if (r.ok) {
        const d = r.data
        toast.success(
          d.outcome === "reject"
            ? "Decision recorded. The candidate can now read your explanation."
            : d.outcome === "regrade"
              ? `Regrade saved. New total ${fmtMarks(d.newTotal)}.${d.reportsReplaced ? " The previous report code now shows Replaced." : ""}`
              : `Question voided for ${d.affected} paper${d.affected === 1 ? "" : "s"}.${d.alsoClosed ? ` ${d.alsoClosed} other dispute${d.alsoClosed === 1 ? "" : "s"} on it closed with the same decision.` : ""}`
        )
        router.refresh()
      } else {
        setErrors(r.fields ?? {})
        toast.error(r.message)
      }
    } catch {
      toast.error("Could not reach the server. Nothing was changed. Try again.")
    } finally {
      setBusy(false)
      setConfirmVoid(false)
    }
  }

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        if (!validate()) return
        if (outcome === "void") setConfirmVoid(true)
        else void submit()
      }}
    >
      <FieldGroup>
        <FieldSet data-invalid={!!errors.outcome}>
          <FieldLegend variant="label">Decision</FieldLegend>
          <div className="grid gap-2">
            {OUTCOMES.map((o) => (
              <label
                key={o.key}
                className={cn(
                  "flex cursor-pointer gap-3 rounded-lg border p-3 text-sm transition-colors hover:bg-muted/50 has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50",
                  outcome === o.key && "border-primary bg-brand-softer"
                )}
              >
                <input type="radio" name="outcome" value={o.key} checked={outcome === o.key} onChange={() => setOutcome(o.key)} className="mt-1" />
                <span>
                  <span className="flex items-center gap-1.5 font-medium">
                    <o.icon className="size-4" aria-hidden />
                    {o.label}
                  </span>
                  <span className="text-muted-foreground">{o.help}</span>
                </span>
              </label>
            ))}
          </div>
          {errors.outcome && <FieldError errors={[{ message: errors.outcome }]} />}
        </FieldSet>

        {outcome === "regrade" && (
          <Field data-invalid={!!errors.marks}>
            <FieldLabel htmlFor="res-marks">
              New mark (0 to {fmtMarks(max)}, currently {current === null ? "not graded" : fmtMarks(current)})
            </FieldLabel>
            <Input
              id="res-marks"
              type="number"
              inputMode="decimal"
              min={0}
              max={max}
              step={0.5}
              value={marks}
              onChange={(e) => setMarks(e.target.value)}
              aria-invalid={!!errors.marks}
              className="max-w-40 tabular-nums"
            />
            <FieldDescription>For objective questions this overrides the automatic mark for this candidate only.</FieldDescription>
            {errors.marks && <FieldError errors={[{ message: errors.marks }]} />}
          </Field>
        )}

        {outcome === "void" && (
          <FieldSet data-invalid={!!errors.policy}>
            <FieldLegend variant="label">How the void applies to all {cohort} submitted paper{cohort === 1 ? "" : "s"}</FieldLegend>
            <div className="grid gap-2">
              {(["exclude", "full_marks"] as const).map((p) => (
                <label
                  key={p}
                  className={cn(
                    "flex cursor-pointer gap-3 rounded-lg border p-3 text-sm hover:bg-muted/50 has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50",
                    policy === p && "border-primary bg-brand-softer"
                  )}
                >
                  <input type="radio" name="policy" value={p} checked={policy === p} onChange={() => setPolicy(p)} className="mt-1" />
                  <span>{VOID_POLICY_LABEL[p]}</span>
                </label>
              ))}
            </div>
            {errors.policy && <FieldError errors={[{ message: errors.policy }]} />}
          </FieldSet>
        )}

        <Field data-invalid={!!errors.note}>
          <FieldLabel htmlFor="res-note">Explanation for the candidate</FieldLabel>
          <Textarea id="res-note" rows={3} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} aria-invalid={!!errors.note} />
          <FieldDescription>The candidate reads this on their result. It is also kept in the audit log.</FieldDescription>
          {errors.note && <FieldError errors={[{ message: errors.note }]} />}
        </Field>
      </FieldGroup>
      <div className="mt-5 flex justify-end">
        <Button type="submit" disabled={busy}>
          {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Check />}
          Record decision
        </Button>
      </div>

      <AlertDialog open={confirmVoid} onOpenChange={(o) => !busy && setConfirmVoid(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Void this question for everyone?</AlertDialogTitle>
            <AlertDialogDescription>
              {policy ? VOID_POLICY_LABEL[policy] : ""}. This recalculates {cohort} submitted paper{cohort === 1 ? "" : "s"}, replaces any issued
              report whose score changes, and closes other open disputes on this question with the same decision. It cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <Button variant="destructive" disabled={busy} onClick={() => void submit()}>
              {busy && <Loader2 className="animate-spin" aria-hidden />}
              Void for everyone
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </form>
  )
}
