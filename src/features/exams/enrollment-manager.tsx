"use client"

import * as React from "react"
import { Loader2, Search, UserMinus, UserPlus, Users } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Panel, PanelHeader } from "@/components/shell/page-header"
import { ConfirmAction, useAction } from "@/components/shell/common"
import { fmtMarks } from "@/lib/format"
import { enrollAction, searchCandidatesAction, unenrollAction } from "./actions"

type Row = {
  candidateId: string
  name: string
  email: string
  active: boolean
  state: "not_started" | "in_progress" | "submitted"
  score: number | null
  grading: "pending" | "graded" | null
}

const STATE = {
  not_started: { label: "Not started", variant: "muted" },
  in_progress: { label: "Writing now", variant: "success" },
  submitted: { label: "Submitted", variant: "info" },
} as const

function EnrollDialog({ examId, open, onOpenChange }: { examId: string; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { run, pending } = useAction()
  const [q, setQ] = React.useState("")
  const [loading, setLoading] = React.useState(false)
  const [results, setResults] = React.useState<{ id: string; name: string; email: string; enrolled: boolean }[]>([])
  const [selected, setSelected] = React.useState<Set<string>>(new Set())

  React.useEffect(() => {
    if (!open) return
    let cancelled = false
    const t = setTimeout(async () => {
      setLoading(true)
      const r = await searchCandidatesAction(examId, q).catch(() => null)
      if (cancelled) return
      setLoading(false)
      if (r?.ok) setResults(r.data)
      else toast.error(r?.message ?? "Could not load candidates. Check your connection.")
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [q, open, examId])

  const selectable = results.filter((r) => !r.enrolled)
  const allSelected = selectable.length > 0 && selectable.every((r) => selected.has(r.id))

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o)
        if (!o) setSelected(new Set())
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Enroll candidates</DialogTitle>
          <DialogDescription>Only enrolled candidates can see and start this exam.</DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input aria-label="Search candidates" placeholder="Search by name or email" className="pl-8" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <label className="flex items-center gap-2">
            <Checkbox
              checked={allSelected}
              disabled={!selectable.length}
              onCheckedChange={(v) => setSelected(v ? new Set(selectable.map((r) => r.id)) : new Set())}
            />
            Select all shown
          </label>
          <span aria-live="polite">{loading ? "Searching" : `${selected.size} selected`}</span>
        </div>
        <ul className="max-h-72 divide-y overflow-y-auto rounded-lg border">
          {results.map((r) => (
            <li key={r.id}>
              <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-muted/50 has-disabled:cursor-default has-disabled:opacity-60">
                <Checkbox
                  checked={r.enrolled || selected.has(r.id)}
                  disabled={r.enrolled}
                  onCheckedChange={(v) =>
                    setSelected((s) => {
                      const n = new Set(s)
                      if (v) n.add(r.id)
                      else n.delete(r.id)
                      return n
                    })
                  }
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{r.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">{r.email}</span>
                </span>
                {r.enrolled && <Badge variant="muted">Enrolled</Badge>}
              </label>
            </li>
          ))}
          {!results.length && !loading && <li className="px-3 py-8 text-center text-sm text-muted-foreground">No candidates found.</li>}
        </ul>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!selected.size || pending}
            onClick={async () => {
              const r = await run(() => enrollAction(examId, [...selected]))
              if (r.ok) {
                const d = r.data as { added: number }
                toast.success(`${d.added} candidate${d.added === 1 ? "" : "s"} enrolled.`)
                setSelected(new Set())
                onOpenChange(false)
              }
            }}
          >
            {pending && <Loader2 className="animate-spin" aria-hidden />}
            Enroll {selected.size || ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function EnrollmentManager({ examId, rows, closed, maxMarks }: { examId: string; rows: Row[]; closed: boolean; maxMarks: number }) {
  const { run } = useAction()
  const [open, setOpen] = React.useState(false)
  const counts = { not_started: 0, in_progress: 0, submitted: 0 }
  for (const r of rows) counts[r.state]++

  return (
    <Panel>
      <PanelHeader
        title={`Enrolled candidates (${rows.length})`}
        description={`${counts.not_started} not started, ${counts.in_progress} writing, ${counts.submitted} submitted`}
        actions={
          !closed && (
            <Button onClick={() => setOpen(true)}>
              <UserPlus />
              Enroll candidates
            </Button>
          )
        }
      />
      {rows.length ? (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-5">Candidate</TableHead>
                <TableHead>Attempt</TableHead>
                <TableHead className="text-right">Score</TableHead>
                <TableHead className="pr-5 text-right">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.candidateId}>
                  <TableCell className="pl-5">
                    <p className="font-medium">
                      {r.name} {!r.active && <Badge variant="warning">Deactivated</Badge>}
                    </p>
                    <p className="text-xs text-muted-foreground">{r.email}</p>
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATE[r.state].variant}>{STATE[r.state].label}</Badge>
                    {r.state === "submitted" && r.grading === "pending" && (
                      <Badge variant="warning" className="ml-1.5">
                        Needs grading
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.state === "submitted" && r.score !== null ? `${fmtMarks(r.score)} / ${fmtMarks(maxMarks)}` : "-"}
                  </TableCell>
                  <TableCell className="pr-5 text-right">
                    {r.state === "not_started" && !closed && (
                      <ConfirmAction
                        title={`Remove ${r.name}?`}
                        description="They will no longer see this exam."
                        confirmLabel="Remove"
                        destructive
                        onConfirm={() => run(() => unenrollAction(examId, r.candidateId))}
                        trigger={(o) => (
                          <Button variant="ghost" size="sm" onClick={o} aria-label={`Remove ${r.name}`}>
                            <UserMinus />
                          </Button>
                        )}
                      />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <Empty className="py-14">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Users />
            </EmptyMedia>
            <EmptyTitle>No one is enrolled yet</EmptyTitle>
            <EmptyDescription>Enroll candidates so the exam appears on their dashboard.</EmptyDescription>
          </EmptyHeader>
          {!closed && <Button onClick={() => setOpen(true)}>Enroll candidates</Button>}
        </Empty>
      )}
      <EnrollDialog examId={examId} open={open} onOpenChange={setOpen} />
    </Panel>
  )
}
