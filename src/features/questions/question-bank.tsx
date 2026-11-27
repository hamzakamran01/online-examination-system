"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Archive, BookOpen, Copy, Pencil, Search } from "lucide-react"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Panel } from "@/components/shell/page-header"
import { ConfirmAction, NativeSelect, useAction } from "@/components/shell/common"
import { DifficultyBadge, TypeBadge } from "@/components/shell/status"
import { fmtMarks } from "@/lib/format"
import { SCHEME_LABEL, type QuestionFilter } from "@/lib/validation/questions"
import { archiveQuestionAction, duplicateQuestionAction } from "./actions"

type Row = {
  id: string
  type: "single" | "multi" | "written"
  difficulty: "easy" | "medium" | "hard"
  stem: string
  defaultMarks: number
  multiScheme: "all_or_nothing" | "partial"
  topicName: string | null
  optionCount: number
  usedIn: number
  updatedAt: string
}

export function QuestionBank({ rows, topics, filter }: { rows: Row[]; topics: { id: string; name: string }[]; filter: QuestionFilter }) {
  const router = useRouter()
  const pathname = usePathname()
  const { run, pending } = useAction()
  const [q, setQ] = React.useState(filter.q ?? "")

  const setParam = (key: string, value: string) => {
    const p = new URLSearchParams()
    const next = { ...filter, q, [key]: value }
    for (const [k, v] of Object.entries(next)) if (v) p.set(k, String(v))
    router.replace(`${pathname}?${p.toString()}`)
  }

  React.useEffect(() => {
    if ((filter.q ?? "") === q) return
    const t = setTimeout(() => setParam("q", q), 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q])

  const filtered = Boolean(filter.q || filter.type || filter.difficulty || filter.topic)

  return (
    <Panel>
      <div className="grid gap-3 border-b p-4 md:grid-cols-[1fr_auto_auto_auto]">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input aria-label="Search question text" placeholder="Search question text" className="pl-8" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <NativeSelect aria-label="Topic" className="md:w-48" value={filter.topic ?? ""} onChange={(e) => setParam("topic", e.target.value)}>
          <option value="">All topics</option>
          {topics.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect aria-label="Type" className="md:w-40" value={filter.type ?? ""} onChange={(e) => setParam("type", e.target.value)}>
          <option value="">All types</option>
          <option value="single">Single answer</option>
          <option value="multi">Multiple select</option>
          <option value="written">Written</option>
        </NativeSelect>
        <NativeSelect aria-label="Difficulty" className="md:w-36" value={filter.difficulty ?? ""} onChange={(e) => setParam("difficulty", e.target.value)}>
          <option value="">All levels</option>
          <option value="easy">Easy</option>
          <option value="medium">Medium</option>
          <option value="hard">Hard</option>
        </NativeSelect>
      </div>

      <p className="px-5 pt-3 text-xs text-muted-foreground" aria-live="polite">
        {rows.length} question{rows.length === 1 ? "" : "s"}
        {filtered ? " match these filters" : " in your bank"}
      </p>

      {rows.length ? (
        <ul className="divide-y">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start">
              <div className="min-w-0 flex-1 space-y-2">
                <p className="line-clamp-2 font-medium">{r.stem}</p>
                <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                  <TypeBadge type={r.type} />
                  <DifficultyBadge difficulty={r.difficulty} />
                  {r.topicName && <span className="rounded-full bg-muted px-2 py-0.5">{r.topicName}</span>}
                  <span>{fmtMarks(r.defaultMarks)} mark{r.defaultMarks === 1 ? "" : "s"}</span>
                  {r.type === "multi" && <span>· {SCHEME_LABEL[r.multiScheme]}</span>}
                  {r.type !== "written" && <span>· {r.optionCount} options</span>}
                  {r.usedIn > 0 && <span>· used in {r.usedIn} exam{r.usedIn === 1 ? "" : "s"}</span>}
                </div>
              </div>
              <div className="flex shrink-0 gap-1">
                <Link href={`/examiner/bank/${r.id}`} className={buttonVariants({ variant: "ghost", size: "sm" })} aria-label={`Edit question: ${r.stem.slice(0, 40)}`}>
                  <Pencil />
                  Edit
                </Link>
                <Button variant="ghost" size="sm" disabled={pending} onClick={() => run(() => duplicateQuestionAction(r.id))} aria-label="Duplicate question">
                  <Copy />
                </Button>
                <ConfirmAction
                  title="Archive this question?"
                  description="It will disappear from the bank and cannot be added to new exams. Past attempts keep their frozen copy."
                  confirmLabel="Archive"
                  destructive
                  onConfirm={() => run(() => archiveQuestionAction(r.id))}
                  trigger={(open) => (
                    <Button variant="ghost" size="sm" onClick={open} aria-label="Archive question">
                      <Archive />
                    </Button>
                  )}
                />
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <Empty className="py-16">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <BookOpen />
            </EmptyMedia>
            <EmptyTitle>{filtered ? "No matching questions" : "Your bank is empty"}</EmptyTitle>
            <EmptyDescription>
              {filtered ? "Try clearing a filter." : "Add your first question to start building exams."}
            </EmptyDescription>
          </EmptyHeader>
          {!filtered && (
            <Link href="/examiner/bank/new" className={buttonVariants()}>
              New question
            </Link>
          )}
        </Empty>
      )}
    </Panel>
  )
}
