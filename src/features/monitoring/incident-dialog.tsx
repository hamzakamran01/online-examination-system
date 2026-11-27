"use client"

/**
 * Declare an outage (I-5.3). When the server or a whole lab's network goes down, the
 * examiner should not extend 40 candidates one by one. They pick the window, the server
 * shows who it measured as cut off during it, and each affected candidate receives their
 * own measured amount under one audited reason. Nothing is applied until confirmed.
 */
import * as React from "react"
import { useQueryClient } from "@tanstack/react-query"
import { CircleCheck, Loader2, Search, ServerCrash, WifiOff } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { COMPENSATION_LABEL } from "@/lib/domain/incidents"
import { declareIncidentSchema, incidentWindowSchema } from "@/lib/validation/monitoring"
import type { IncidentPlan } from "@/server/services/monitoring"
import { declareIncidentAction, previewIncidentAction } from "./actions"

const pad = (n: number) => String(n).padStart(2, "0")
/** datetime-local value in the examiner's local time zone. */
function toLocalInput(ms: number) {
  const d = new Date(ms)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
const fromLocalInput = (v: string) => {
  const t = Date.parse(v)
  return Number.isNaN(t) ? "" : new Date(t).toISOString()
}
function dur(sec: number) {
  if (sec < 60) return `${sec} s`
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return s ? `${m} min ${s} s` : `${m} min`
}
const hm = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })

export function IncidentDialog({
  examId,
  open,
  onClose,
  serverNow,
  examStartsAt,
}: {
  examId: string
  open: boolean
  onClose: () => void
  serverNow: number
  examStartsAt: string
}) {
  const qc = useQueryClient()
  const [from, setFrom] = React.useState("")
  const [to, setTo] = React.useState("")
  const [reason, setReason] = React.useState("")
  const [plan, setPlan] = React.useState<IncidentPlan | null>(null)
  const [errors, setErrors] = React.useState<Record<string, string>>({})
  const [busy, setBusy] = React.useState<"preview" | "grant" | null>(null)
  const requestKey = React.useRef("")

  React.useEffect(() => {
    if (!open) return
    const now = serverNow
    queueMicrotask(() => {
      setFrom(toLocalInput(Math.max(Date.parse(examStartsAt), now - 15 * 60_000)))
      setTo(toLocalInput(now))
      setReason("")
      setPlan(null)
      setErrors({})
    })
    // One key per opened dialog: a double click or a retried request grants exactly once.
    requestKey.current = crypto.randomUUID()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const preset = (minutes: number | "start") => {
    const now = serverNow
    setFrom(toLocalInput(minutes === "start" ? Date.parse(examStartsAt) : Math.max(Date.parse(examStartsAt), now - minutes * 60_000)))
    setTo(toLocalInput(now))
    setPlan(null)
  }

  const preview = async () => {
    const input = { from: fromLocalInput(from), to: fromLocalInput(to) }
    const parsed = incidentWindowSchema.safeParse(input)
    if (!parsed.success) {
      const next: Record<string, string> = {}
      for (const i of parsed.error.issues) next[String(i.path[0])] ??= i.message
      setErrors(next)
      return
    }
    setErrors({})
    setBusy("preview")
    try {
      const r = await previewIncidentAction(examId, input)
      if (r.ok) {
        setPlan(r.data)
        if (!reason)
          setReason(`Outage between ${hm(r.data.from)} and ${hm(r.data.to)}: candidates lost contact with the exam server.`)
      } else {
        setErrors(r.fields ?? {})
        toast.error(r.message)
      }
    } catch {
      toast.error("Could not reach the server. Check your connection and try again.")
    } finally {
      setBusy(null)
    }
  }

  const grant = async () => {
    if (!plan) return
    const input = { from: plan.from, to: plan.to, reason, requestKey: requestKey.current }
    const parsed = declareIncidentSchema.safeParse(input)
    if (!parsed.success) {
      const next: Record<string, string> = {}
      for (const i of parsed.error.issues) next[String(i.path[0])] ??= i.message
      setErrors(next)
      return
    }
    setBusy("grant")
    try {
      const r = await declareIncidentAction(examId, input)
      if (r.ok) {
        toast.success(`Extra time granted to ${r.data.affected} candidate${r.data.affected === 1 ? "" : "s"}.`, {
          description: "Each received their own measured outage. Timers update within 15 seconds. Recorded in the audit log.",
        })
        void qc.invalidateQueries({ queryKey: ["monitor", examId] })
        onClose()
      } else {
        setErrors(r.fields ?? {})
        toast.error(r.message)
      }
    } catch {
      toast.error("The result is unknown because the connection dropped. Reopen the monitor: a repeated grant is ignored.")
    } finally {
      setBusy(null)
    }
  }

  const eligible = plan?.rows.filter((r) => r.status === "eligible") ?? []

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ServerCrash className="size-5 text-warning-text" aria-hidden />
            Declare an outage
          </DialogTitle>
          <DialogDescription>
            For a server or network failure that hit many candidates at once. Each affected candidate gets the time the server
            measured them as cut off inside your window, not a flat amount. Background tabs never count.
          </DialogDescription>
        </DialogHeader>

        <FieldGroup>
          <div role="group" aria-label="Quick windows" className="flex flex-wrap gap-1.5">
            {([10, 30, 60] as const).map((m) => (
              <Button key={m} type="button" size="sm" variant="outline" onClick={() => preset(m)}>
                Last {m === 60 ? "hour" : `${m} min`}
              </Button>
            ))}
            <Button type="button" size="sm" variant="outline" onClick={() => preset("start")}>
              Since the exam started
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field data-invalid={!!errors.from}>
              <FieldLabel htmlFor="inc-from">Outage started</FieldLabel>
              <Input
                id="inc-from"
                type="datetime-local"
                value={from}
                onChange={(e) => {
                  setFrom(e.target.value)
                  setPlan(null)
                }}
                aria-invalid={!!errors.from}
              />
              <FieldError errors={errors.from ? [{ message: errors.from }] : []} />
            </Field>
            <Field data-invalid={!!errors.to}>
              <FieldLabel htmlFor="inc-to">Outage ended</FieldLabel>
              <Input
                id="inc-to"
                type="datetime-local"
                value={to}
                onChange={(e) => {
                  setTo(e.target.value)
                  setPlan(null)
                }}
                aria-invalid={!!errors.to}
              />
              <FieldError errors={errors.to ? [{ message: errors.to }] : []} />
            </Field>
          </div>
          {!plan && (
            <Button type="button" onClick={preview} disabled={busy !== null} className="w-full sm:w-auto">
              {busy === "preview" ? <Loader2 className="animate-spin" aria-hidden /> : <Search />}
              Find affected candidates
            </Button>
          )}
        </FieldGroup>

        {plan && (
          <div className="mt-2 space-y-4">
            <p className="rounded-lg border bg-muted/40 p-3 text-sm" role="status">
              {eligible.length ? (
                <>
                  <span className="font-medium">
                    {eligible.length} candidate{eligible.length === 1 ? "" : "s"} will receive extra time
                  </span>{" "}
                  ({dur(plan.totalSec)} in total). {plan.rows.length - eligible.length} other writing candidate
                  {plan.rows.length - eligible.length === 1 ? "" : "s"} unaffected.
                  {plan.submittedSkipped > 0 && ` ${plan.submittedSkipped} already submitted.`}
                </>
              ) : (
                <>Nobody still writing lost contact between {hm(plan.from)} and {hm(plan.to)}. Nothing to grant.</>
              )}
            </p>
            {plan.rows.length > 0 && (
              <div className="max-h-72 overflow-auto rounded-lg border" tabIndex={0} role="region" aria-label="Compensation plan">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-3">Candidate</TableHead>
                      <TableHead>Lost contact</TableHead>
                      <TableHead>Already given</TableHead>
                      <TableHead className="pr-3 text-right">Will receive</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {plan.rows.map((r) => (
                      <TableRow key={r.attemptId} className={cn(r.status !== "eligible" && "text-muted-foreground")}>
                        <TableCell className="pl-3">
                          <p className="font-medium text-foreground">{r.name}</p>
                          <p className="text-xs">{COMPENSATION_LABEL[r.status]}</p>
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {r.outageSec ? dur(r.outageSec) : "None"}
                          {r.stillOut && (
                            <Badge variant="warning" className="ml-1.5">
                              <WifiOff aria-hidden />
                              Still out
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="tabular-nums">{r.compensatedSec ? dur(r.compensatedSec) : "None"}</TableCell>
                        <TableCell className="pr-3 text-right font-medium tabular-nums">
                          {r.status === "eligible" ? <span className="text-foreground">+{dur(r.seconds)}</span> : "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            {eligible.length > 0 && (
              <Field data-invalid={!!errors.reason}>
                <FieldLabel htmlFor="inc-reason">Reason (one for everyone)</FieldLabel>
                <Textarea id="inc-reason" rows={2} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} aria-invalid={!!errors.reason} />
                <FieldDescription>
                  Kept in the audit log with each grant and its measured outage. Candidates only see how much time was added.
                </FieldDescription>
                <FieldError errors={errors.reason ? [{ message: errors.reason }] : []} />
              </Field>
            )}
          </div>
        )}

        <DialogFooter className="mt-4">
          <Button type="button" variant="outline" onClick={plan ? () => setPlan(null) : onClose} disabled={busy !== null}>
            {plan ? "Change window" : "Cancel"}
          </Button>
          {plan && eligible.length > 0 && (
            <Button type="button" onClick={grant} disabled={busy !== null}>
              {busy === "grant" ? <Loader2 className="animate-spin" aria-hidden /> : <CircleCheck />}
              Grant to {eligible.length} candidate{eligible.length === 1 ? "" : "s"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
