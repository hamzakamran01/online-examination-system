"use client"

import * as React from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  Activity,
  CircleAlert,
  Clock,
  History,
  Loader2,
  Megaphone,
  RefreshCw,
  Send,
  ServerCrash,
  ShieldAlert,
  TimerReset,
  WifiOff,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Panel, PanelHeader } from "@/components/shell/page-header"
import { useAction } from "@/components/shell/common"
import { fmtClock, fmtDateTime } from "@/lib/format"
import {
  EXTENSION_CAP_SEC,
  LIVE_STATE_LABEL,
  MONITOR_POLL_MS,
  SIGNAL_DISCLAIMER,
  SIGNAL_LABEL,
  GAP_CAUSE_LABEL,
  suggestExtensionSec,
  type GapCause,
  type LiveState,
} from "@/lib/domain/monitoring"
import { announcementSchema, extensionSchema, type AnnouncementInput, type ExtensionInput } from "@/lib/validation/monitoring"
import type { MonitorRow, MonitorView, TimelineView } from "@/server/services/monitoring"
import { grantExtensionAction, postAnnouncementAction } from "./actions"
import { IncidentDialog } from "./incident-dialog"

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" })
  const body = await res.json().catch(() => null)
  if (!res.ok) throw new Error(body?.error?.message ?? "Could not load live data.")
  return body as T
}

/* Server-anchored clock: the board ticks every second between polls without trusting the device date. */
function useServerNow(serverNow: string | undefined) {
  const [now, setNow] = React.useState<number | null>(null)
  React.useEffect(() => {
    if (!serverNow) return
    // performance.now() is monotonic: changing the examiner's device clock cannot skew the board.
    const anchor = { server: Date.parse(serverNow), mono: performance.now() }
    const tick = () => setNow(anchor.server + (performance.now() - anchor.mono))
    const first = setTimeout(tick, 0)
    const t = setInterval(tick, 1000)
    return () => {
      clearTimeout(first)
      clearInterval(t)
    }
  }, [serverNow])
  return now ?? (serverNow ? Date.parse(serverNow) : 0)
}

const STATE_TONE: Record<LiveState, "success" | "warning" | "muted" | "secondary"> = {
  writing: "success",
  disconnected: "warning",
  not_started: "muted",
  submitted: "secondary",
}

function ago(ms: number) {
  const s = Math.max(0, Math.round(ms / 1000))
  if (s < 60) return `${s} s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m} min ago`
  return `${Math.floor(m / 60)} h ${m % 60} min ago`
}

function secs(n: number) {
  if (n < 60) return `${n} s`
  const m = Math.floor(n / 60)
  const s = n % 60
  return s ? `${m} min ${s} s` : `${m} min`
}

function StateBadge({ state }: { state: LiveState }) {
  return (
    <Badge variant={STATE_TONE[state]} className="gap-1.5">
      {state === "writing" && <span className="size-1.5 animate-pulse rounded-full bg-current" aria-hidden />}
      {state === "disconnected" && <WifiOff aria-hidden />}
      {LIVE_STATE_LABEL[state]}
    </Badge>
  )
}

const FILTERS: { key: "all" | LiveState; label: string }[] = [
  { key: "all", label: "All" },
  { key: "writing", label: "Writing" },
  { key: "disconnected", label: "Disconnected" },
  { key: "not_started", label: "Not started" },
  { key: "submitted", label: "Submitted" },
]

export function MonitorBoard({ examId }: { examId: string }) {
  const q = useQuery({
    queryKey: ["monitor", examId],
    queryFn: () => getJson<MonitorView>(`/api/exams/${examId}/monitor`),
    refetchInterval: MONITOR_POLL_MS,
    refetchIntervalInBackground: false,
    staleTime: 0,
  })
  const now = useServerNow(q.data?.serverNow)
  const [filter, setFilter] = React.useState<"all" | LiveState>("all")
  const [timelineFor, setTimelineFor] = React.useState<MonitorRow | null>(null)
  const [extendFor, setExtendFor] = React.useState<MonitorRow | null>(null)
  const [incidentOpen, setIncidentOpen] = React.useState(false)

  if (q.isPending)
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Loading live monitor">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-72 rounded-xl" />
      </div>
    )

  if (q.isError && !q.data)
    return (
      <Panel className="p-6">
        <p className="flex items-center gap-2 text-sm text-danger-text">
          <CircleAlert className="size-4" aria-hidden />
          {q.error.message}
        </p>
        <Button variant="outline" className="mt-4" onClick={() => q.refetch()}>
          <RefreshCw />
          Try again
        </Button>
      </Panel>
    )

  const v = q.data!
  const rows = filter === "all" ? v.rows : v.rows.filter((r) => r.state === filter)
  const live = v.exam.status === "ongoing"

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status" aria-live="polite">
          {q.isError ? (
            <>
              <CircleAlert className="size-4 text-warning-text" aria-hidden />
              <span className="text-warning-text">Live updates paused (connection problem). Retrying automatically.</span>
            </>
          ) : (
            <>
              <span className={cn("size-2 rounded-full", live ? "animate-pulse bg-success" : "bg-muted-foreground/50")} aria-hidden />
              {live ? `Live. Refreshes every ${MONITOR_POLL_MS / 1000} seconds.` : v.exam.status === "published" ? "The exam has not started yet." : "The exam window has closed."}
              {q.isFetching && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
            </>
          )}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-xs text-muted-foreground">Server time {new Date(now).toLocaleTimeString()}</p>
          {v.canAct && live && (
            <Button size="sm" variant="outline" onClick={() => setIncidentOpen(true)}>
              <ServerCrash />
              Declare an outage
            </Button>
          )}
        </div>
      </div>

      {v.incidents.length > 0 && (
        <Panel className="p-4">
          <p className="mb-2 flex items-center gap-2 text-sm font-medium">
            <ServerCrash className="size-4 text-warning-text" aria-hidden />
            Declared outages
          </p>
          <ul className="space-y-1.5 text-sm">
            {v.incidents.map((i) => (
              <li key={i.id} className="flex flex-wrap gap-x-2">
                <span className="font-medium tabular-nums">
                  {new Date(i.windowFrom).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} to{" "}
                  {new Date(i.windowTo).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
                <span className="text-muted-foreground">
                  {i.affected} candidate{i.affected === 1 ? "" : "s"} compensated, {secs(i.totalSec)} in total, by {i.declaredBy ?? "an examiner"}.
                </span>
                <span className="w-full text-xs text-muted-foreground">Reason: {i.reason}</span>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {(
          [
            ["writing", "Writing", "success"],
            ["disconnected", "Disconnected", "warning"],
            ["not_started", "Not started", undefined],
            ["submitted", "Submitted", undefined],
          ] as const
        ).map(([key, label, tone]) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(filter === key ? "all" : key)}
            aria-pressed={filter === key}
            className={cn(
              "rounded-xl border bg-card p-4 text-left shadow-panel transition-colors hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
              filter === key && "border-primary ring-1 ring-primary"
            )}
          >
            <span className="block text-xs font-medium text-muted-foreground">{label}</span>
            <span
              className={cn(
                "mt-1 block text-2xl font-semibold tabular-nums",
                tone === "success" && v.summary[key] > 0 && "text-success-text",
                tone === "warning" && v.summary[key] > 0 && "text-warning-text"
              )}
            >
              {v.summary[key]}
              <span className="ml-1 text-sm font-normal text-muted-foreground">/ {v.summary.enrolled}</span>
            </span>
          </button>
        ))}
        <div className="col-span-2 rounded-xl border bg-card p-4 shadow-panel sm:col-span-1">
          <span className="block text-xs font-medium text-muted-foreground">Signals for review</span>
          <span className="mt-1 block text-2xl font-semibold tabular-nums">{v.summary.signals}</span>
        </div>
      </div>

      {/* The table needs the full width on laptop screens; the side column only appears on very wide displays. */}
      <div className="grid gap-6 min-[1800px]:grid-cols-[1fr_360px]">
        <Panel className="min-w-0">
          <PanelHeader
            title="Candidates"
            description="States come from the server clock. Disconnected means no save or heartbeat for 30 seconds."
            actions={
              <div role="group" aria-label="Filter candidates" className="flex flex-wrap gap-1">
                {FILTERS.map((f) => (
                  <Button key={f.key} size="sm" variant={filter === f.key ? "secondary" : "ghost"} aria-pressed={filter === f.key} onClick={() => setFilter(f.key)}>
                    {f.label}
                  </Button>
                ))}
              </div>
            }
          />
          {v.rows.length === 0 ? (
            <Empty className="py-12">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Activity />
                </EmptyMedia>
                <EmptyTitle>No candidates enrolled</EmptyTitle>
                <EmptyDescription>Enroll candidates on the Candidates tab. They appear here as soon as they are added.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : rows.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">No candidates in this state right now.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-5">Candidate</TableHead>
                    <TableHead>State</TableHead>
                    <TableHead>Progress</TableHead>
                    <TableHead>Time left</TableHead>
                    <TableHead>Last contact</TableHead>
                    <TableHead>Signals</TableHead>
                    <TableHead className="pr-5 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <CandidateRow key={r.candidateId} r={r} now={now} canAct={v.canAct} onTimeline={() => setTimelineFor(r)} onExtend={() => setExtendFor(r)} />
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Panel>

        <AnnouncementsPanel examId={examId} view={v} />
      </div>

      <TimelineSheet examId={examId} row={timelineFor} onClose={() => setTimelineFor(null)} />
      <ExtendDialog examId={examId} row={extendFor} now={now} onClose={() => setExtendFor(null)} />
      <IncidentDialog examId={examId} open={incidentOpen} onClose={() => setIncidentOpen(false)} serverNow={now} examStartsAt={v.exam.startsAt} />
    </div>
  )
}

function CandidateRow({ r, now, canAct, onTimeline, onExtend }: { r: MonitorRow; now: number; canAct: boolean; onTimeline: () => void; onExtend: () => void }) {
  const remaining = r.deadlineAt ? Date.parse(r.deadlineAt) - now : null
  const active = r.state === "writing" || r.state === "disconnected"
  const pct = r.total ? Math.round((r.answered / r.total) * 100) : 0
  return (
    <TableRow className={cn(r.state === "disconnected" && "bg-warning-soft/40")}>
      <TableCell className="pl-5">
        <p className="font-medium">{r.name}</p>
        <p className="text-xs text-muted-foreground">{r.email}</p>
      </TableCell>
      <TableCell>
        <StateBadge state={r.state} />
        {r.state === "submitted" && r.submitReason && r.submitReason !== "candidate" && (
          <p className="mt-1 text-xs text-muted-foreground">{r.submitReason === "timeout" ? "At time limit" : "Closed by examiner"}</p>
        )}
      </TableCell>
      <TableCell className="min-w-32">
        {r.attemptId ? (
          <div className="space-y-1">
            <p className="text-sm tabular-nums">
              {r.answered} / {r.total} answered
            </p>
            <div className="h-1.5 w-28 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${r.name} progress`}>
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
            </div>
          </div>
        ) : (
          <span className="text-sm text-muted-foreground">-</span>
        )}
      </TableCell>
      <TableCell className="font-mono text-sm tabular-nums">
        {active && remaining !== null ? (
          <span className={cn(remaining < 5 * 60_000 && "text-warning-text")}>{fmtClock(remaining)}</span>
        ) : (
          <span className="font-sans text-muted-foreground">-</span>
        )}
        {r.extensionSec > 0 && <p className="font-sans text-xs text-info-text">+{secs(r.extensionSec)} granted</p>}
      </TableCell>
      <TableCell className="text-sm">
        {active && r.lastSeenAt ? (
          <span className={cn(r.state === "disconnected" && "font-medium text-warning-text")}>{ago(now - Date.parse(r.lastSeenAt))}</span>
        ) : (
          <span className="text-muted-foreground">-</span>
        )}
        {r.gapSec > 0 && <p className="text-xs text-muted-foreground">Outages: {secs(r.gapSec)}</p>}
        {r.backgroundSec > 0 && (
          <p className="text-xs text-muted-foreground" title="The tab was in the background, so the browser slowed its timers. Not counted as an outage.">
            Background tab: {secs(r.backgroundSec)}
          </p>
        )}
      </TableCell>
      <TableCell>
        {r.signals > 0 ? (
          <Badge variant="warning">
            <ShieldAlert aria-hidden />
            {r.signals}
          </Badge>
        ) : (
          <span className="text-sm text-muted-foreground">{r.attemptId ? "None" : "-"}</span>
        )}
      </TableCell>
      <TableCell className="pr-5 text-right">
        <div className="flex justify-end gap-1">
          {r.attemptId && (
            <Button size="sm" variant="ghost" onClick={onTimeline} aria-label={`Timeline for ${r.name}`}>
              <History />
              <span className="hidden md:inline">Timeline</span>
            </Button>
          )}
          {canAct && active && (
            <Button size="sm" variant="outline" onClick={onExtend} disabled={r.extensionSec >= EXTENSION_CAP_SEC} aria-label={`Extra time for ${r.name}`}>
              <TimerReset />
              <span className="hidden md:inline">Extra time</span>
            </Button>
          )}
        </div>
      </TableCell>
    </TableRow>
  )
}

function AnnouncementsPanel({ examId, view }: { examId: string; view: MonitorView }) {
  const qc = useQueryClient()
  const { run, pending } = useAction()
  const form = useForm<AnnouncementInput>({ resolver: zodResolver(announcementSchema), defaultValues: { body: "" } })
  const e = form.formState.errors
  const open = view.exam.status === "ongoing" || view.exam.status === "published"
  const body = form.watch("body") ?? ""

  return (
    <Panel className="h-fit">
      <PanelHeader title="Announcements" description="Shown to every candidate of this exam as a banner, within 15 seconds." />
      <div className="grid gap-5 p-5 lg:grid-cols-2 min-[1800px]:grid-cols-1">
        {view.canAct && open && (
          <form
            noValidate
            onSubmit={form.handleSubmit(async (values) => {
              const r = await run(() => postAnnouncementAction(examId, values), { refresh: false })
              if (r.ok) {
                form.reset({ body: "" })
                void qc.invalidateQueries({ queryKey: ["monitor", examId] })
              } else if (r.fields?.body) form.setError("body", { message: r.fields.body })
            })}
          >
            <FieldGroup>
              <Field data-invalid={!!e.body}>
                <FieldLabel htmlFor="ann-body">New announcement</FieldLabel>
                <Textarea id="ann-body" rows={3} maxLength={500} aria-invalid={!!e.body} placeholder="For example: Question 4 has a typo. Read 'kilometres' as 'metres'." {...form.register("body")} />
                <FieldDescription className="flex justify-between">
                  <span>Candidates cannot reply.</span>
                  <span className="tabular-nums">{body.length} / 500</span>
                </FieldDescription>
                <FieldError errors={[e.body]} />
              </Field>
            </FieldGroup>
            <Button type="submit" className="mt-3 w-full" disabled={pending}>
              {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Send />}
              Send to all candidates
            </Button>
          </form>
        )}
        {!open && <p className="text-sm text-muted-foreground">The exam has ended, so new announcements are not delivered.</p>}

        <div>
          <p className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">Sent ({view.announcements.length})</p>
          {view.announcements.length ? (
            <ol className="max-h-96 space-y-2 overflow-y-auto">
              {view.announcements.map((a) => (
                <li key={a.id} className="rounded-lg border bg-muted/30 p-3 text-sm">
                  <p className="whitespace-pre-wrap">{a.body}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {fmtDateTime(a.createdAt)}
                    {a.author ? `, ${a.author}` : ""}
                  </p>
                </li>
              ))}
            </ol>
          ) : (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Megaphone className="size-4" aria-hidden />
              No announcements yet.
            </p>
          )}
        </div>
      </div>
    </Panel>
  )
}

function eventDetail(e: TimelineView["events"][number]) {
  const d = e.detail as { durationMs?: number; gapSec?: number; seconds?: number; lateByMs?: number; reason?: string; cause?: GapCause; incidentId?: string }
  if (e.type === "tab_hidden" && d.durationMs) return `Away for ${secs(Math.round(d.durationMs / 1000))}`
  if (e.type === "offline" && d.durationMs) return `Offline for ${secs(Math.round(d.durationMs / 1000))}`
  if (e.type === "connection_gap" && d.gapSec)
    return `Server heard nothing for ${secs(d.gapSec)} (measured by the server). Likely cause: ${GAP_CAUSE_LABEL[d.cause ?? "no_contact"].toLowerCase()}.`
  if (e.type === "extension_granted" && d.seconds) return `+${secs(d.seconds)}${d.incidentId ? " for a declared outage" : ""}`
  if (e.type === "late_save_rejected" && d.lateByMs) return `${secs(Math.round(d.lateByMs / 1000))} after the deadline`
  return null
}

const SIGNAL_TYPES = new Set(["tab_hidden", "fullscreen_exit", "offline", "connection_gap", "device_change", "late_save_rejected"])

function TimelineSheet({ examId, row, onClose }: { examId: string; row: MonitorRow | null; onClose: () => void }) {
  const q = useQuery({
    queryKey: ["timeline", examId, row?.attemptId],
    queryFn: () => getJson<TimelineView>(`/api/exams/${examId}/monitor/attempts/${row!.attemptId}`),
    enabled: !!row?.attemptId,
    refetchInterval: MONITOR_POLL_MS * 2,
  })
  return (
    <Sheet open={!!row} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Activity timeline</SheetTitle>
          <SheetDescription>{row?.name}</SheetDescription>
        </SheetHeader>
        <div className="space-y-4 px-4 pb-6">
          <p className="flex gap-2 rounded-lg border border-info/30 bg-info-soft p-3 text-xs text-info-text">
            <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            {SIGNAL_DISCLAIMER}
          </p>
          {q.isPending ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }, (_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : q.isError ? (
            <p className="text-sm text-danger-text">{q.error.message}</p>
          ) : (
            <>
              {q.data.extensions.length > 0 && (
                <div className="rounded-lg border p-3">
                  <p className="mb-2 text-sm font-medium">Extra time granted</p>
                  <ul className="space-y-1.5 text-sm">
                    {q.data.extensions.map((x) => (
                      <li key={x.id}>
                        <span className="font-medium">+{secs(x.seconds)}</span> by {x.grantedBy ?? "an examiner"}, {fmtDateTime(x.createdAt)}
                        {x.incidentId && <Badge variant="outline" className="ml-1.5">Declared outage</Badge>}
                        <p className="text-xs text-muted-foreground">Reason: {x.reason}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <ol className="relative space-y-3 border-l pl-5">
                {q.data.events.map((e) => {
                  const signal = SIGNAL_TYPES.has(e.type) && !(e.type === "connection_gap" && (e.detail as { cause?: string }).cause === "background_tab")
                  const detail = eventDetail(e)
                  return (
                    <li key={e.id} className="relative">
                      <span
                        className={cn("absolute top-1.5 -left-[1.6rem] size-2.5 rounded-full ring-4 ring-card", signal ? "bg-warning" : "bg-muted-foreground/50")}
                        aria-hidden
                      />
                      <p className="text-sm font-medium">
                        {SIGNAL_LABEL[e.type] ?? e.type}
                        {signal && <span className="sr-only"> (signal for review)</span>}
                      </p>
                      {detail && <p className="text-xs text-muted-foreground">{detail}</p>}
                      <p className="text-xs text-muted-foreground">
                        {new Date(e.serverTs).toLocaleTimeString()} server time, {e.source === "server" ? "recorded by the server" : "reported by the browser"}
                      </p>
                    </li>
                  )
                })}
              </ol>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function ExtendDialog({ examId, row, now, onClose }: { examId: string; row: MonitorRow | null; now: number; onClose: () => void }) {
  const qc = useQueryClient()
  const { run, pending } = useAction()
  const form = useForm<ExtensionInput>({ resolver: zodResolver(extensionSchema), defaultValues: { attemptId: "", minutes: 5, reason: "" } })
  const e = form.formState.errors
  const roomMin = row ? Math.floor((EXTENSION_CAP_SEC - row.extensionSec) / 60) : 0

  React.useEffect(() => {
    if (!row?.attemptId) return
    const suggested = suggestExtensionSec(row.gapSec, row.extensionSec) / 60
    form.reset({
      attemptId: row.attemptId,
      minutes: Math.max(1, suggested),
      reason: row.gapSec > 0 ? `Connection outage of ${secs(row.gapSec)} measured by the server.` : "",
    })
  }, [row, form])

  return (
    <Dialog open={!!row} onOpenChange={(o) => !o && !pending && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Give extra time</DialogTitle>
          <DialogDescription>
            {row?.name}. Extra time is never automatic. It is recorded with your name and reason in the audit log.
          </DialogDescription>
        </DialogHeader>
        {row && (
          <dl className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="rounded-lg bg-muted p-2">
              <dt className="text-muted-foreground">Measured outage</dt>
              <dd className="text-sm font-semibold">{row.gapSec ? secs(row.gapSec) : "None"}</dd>
            </div>
            <div className="rounded-lg bg-muted p-2">
              <dt className="text-muted-foreground">Already granted</dt>
              <dd className="text-sm font-semibold">{row.extensionSec ? secs(row.extensionSec) : "None"}</dd>
            </div>
            <div className="rounded-lg bg-muted p-2">
              <dt className="text-muted-foreground">Time left now</dt>
              <dd className="font-mono text-sm font-semibold">{row.deadlineAt ? fmtClock(Date.parse(row.deadlineAt) - now) : "-"}</dd>
            </div>
          </dl>
        )}
        <form
          noValidate
          onSubmit={form.handleSubmit(async (values) => {
            const r = await run(() => grantExtensionAction(values), { refresh: false })
            if (r.ok) {
              void qc.invalidateQueries({ queryKey: ["monitor", examId] })
              onClose()
            } else if (r.fields) for (const [k, m] of Object.entries(r.fields)) form.setError(k as keyof ExtensionInput, { message: m })
          })}
        >
          <FieldGroup>
            <Field data-invalid={!!e.minutes}>
              <FieldLabel htmlFor="ext-min">Minutes to add</FieldLabel>
              <Input id="ext-min" type="number" inputMode="numeric" min={1} max={roomMin} step={1} aria-invalid={!!e.minutes} {...form.register("minutes")} />
              <FieldDescription>
                <Clock className="mr-1 inline size-3.5" aria-hidden />
                Up to {roomMin} more minute{roomMin === 1 ? "" : "s"} for this attempt ({EXTENSION_CAP_SEC / 60} in total).
                {row && row.gapSec > row.extensionSec ? " Pre-filled to cover the outage the server measured." : " No outage was measured, so choose the amount yourself."}
              </FieldDescription>
              <FieldError errors={[e.minutes]} />
            </Field>
            <Field data-invalid={!!e.reason}>
              <FieldLabel htmlFor="ext-reason">Reason</FieldLabel>
              <Textarea id="ext-reason" rows={2} maxLength={300} aria-invalid={!!e.reason} {...form.register("reason")} />
              <FieldDescription>Kept in the audit log. The candidate only sees how much time was added.</FieldDescription>
              <FieldError errors={[e.reason]} />
            </Field>
          </FieldGroup>
          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending || roomMin < 1}>
              {pending && <Loader2 className="animate-spin" aria-hidden />}
              Grant extra time
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
