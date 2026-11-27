"use client"

import * as React from "react"
import Link from "next/link"
import { ArrowDown, ArrowUp, Check, Plus, Search, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Panel, PanelHeader } from "@/components/shell/page-header"
import { NativeSelect, useAction } from "@/components/shell/common"
import { DifficultyBadge, TypeBadge } from "@/components/shell/status"
import { fmtMarks, round2 } from "@/lib/format"
import { setExamQuestionsAction } from "./actions"

type Item = {
  questionId: string
  marks: number
  stem: string
  type: "single" | "multi" | "written"
  difficulty: "easy" | "medium" | "hard"
  topicName: string | null
  topicId?: string | null
}

export function QuestionPicker({
  examId,
  totalMarks,
  locked,
  assigned,
  bank,
  topics,
}: {
  examId: string
  totalMarks: number
  locked: boolean
  assigned: Item[]
  bank: Item[]
  topics: { id: string; name: string }[]
}) {
  const { run, pending } = useAction()
  const [items, setItems] = React.useState(assigned)
  const [marksText, setMarksText] = React.useState<Record<string, string>>(() =>
    Object.fromEntries(assigned.map((a) => [a.questionId, String(a.marks)]))
  )
  const [q, setQ] = React.useState("")
  const [topic, setTopic] = React.useState("")
  const [difficulty, setDifficulty] = React.useState("")
  const dirty = JSON.stringify(items.map((i) => [i.questionId, i.marks])) !== JSON.stringify(assigned.map((i) => [i.questionId, i.marks]))

  const chosen = new Set(items.map((i) => i.questionId))
  const sum = round2(items.reduce((s, i) => s + (Number.isFinite(i.marks) ? i.marks : 0), 0))
  const invalid = items.some((i) => !(i.marks > 0) || Math.round(i.marks * 2) !== i.marks * 2)
  const visibleBank = bank.filter(
    (b) =>
      (!q || b.stem.toLowerCase().includes(q.toLowerCase())) &&
      (!topic || b.topicId === topic) &&
      (!difficulty || b.difficulty === difficulty)
  )

  const move = (i: number, d: -1 | 1) =>
    setItems((xs) => {
      const next = [...xs]
      const j = i + d
      if (j < 0 || j >= next.length) return xs
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })

  const add = (b: Item) => {
    setItems((xs) => [...xs, b])
    setMarksText((m) => ({ ...m, [b.questionId]: String(b.marks) }))
  }

  const mix = { easy: 0, medium: 0, hard: 0 }
  for (const i of items) mix[i.difficulty]++

  return (
    <div className="grid gap-6 lg:grid-cols-[1.15fr_1fr]">
      <Panel>
        <PanelHeader
          title={`In this exam (${items.length})`}
          description={
            <span className={cn("tabular-nums", sum === totalMarks ? "text-success-text" : "text-warning-text")}>
              {fmtMarks(sum)} of {fmtMarks(totalMarks)} marks assigned
              {sum !== totalMarks && ` (${sum < totalMarks ? fmtMarks(round2(totalMarks - sum)) + " short" : fmtMarks(round2(sum - totalMarks)) + " over"})`}
            </span>
          }
          actions={
            !locked && (
              <Button
                disabled={pending || !dirty || invalid}
                onClick={() =>
                  run(() => setExamQuestionsAction({ examId, items: items.map((i) => ({ questionId: i.questionId, marks: i.marks })) }))
                }
              >
                <Check />
                Save list
              </Button>
            )
          }
        />
        {items.length > 0 && (
          <p className="px-5 pt-3 text-xs text-muted-foreground">
            Difficulty mix: {mix.easy} easy, {mix.medium} medium, {mix.hard} hard
          </p>
        )}
        {items.length ? (
          <ol className="divide-y">
            {items.map((it, i) => (
              <li key={it.questionId} className="flex gap-3 px-5 py-3">
                <span className="mt-0.5 w-6 shrink-0 text-sm font-medium text-muted-foreground tabular-nums">{i + 1}.</span>
                <div className="min-w-0 flex-1 space-y-1.5">
                  <p className="line-clamp-2 text-sm">{it.stem}</p>
                  <div className="flex flex-wrap gap-1.5">
                    <TypeBadge type={it.type} />
                    <DifficultyBadge difficulty={it.difficulty} />
                  </div>
                </div>
                <div className="flex shrink-0 items-start gap-1">
                  <label className="sr-only" htmlFor={`m-${it.questionId}`}>
                    Marks for question {i + 1}
                  </label>
                  <Input
                    id={`m-${it.questionId}`}
                    type="number"
                    step={0.5}
                    min={0.5}
                    disabled={locked}
                    className={cn("h-8 w-20 text-right tabular-nums", !(it.marks > 0) && "border-destructive")}
                    value={marksText[it.questionId] ?? String(it.marks)}
                    onChange={(e) => {
                      const v = e.target.value
                      setMarksText((m) => ({ ...m, [it.questionId]: v }))
                      setItems((xs) => xs.map((x) => (x.questionId === it.questionId ? { ...x, marks: Number(v) } : x)))
                    }}
                  />
                  {!locked && (
                    <div className="flex flex-col">
                      <Button variant="ghost" size="icon-xs" aria-label={`Move question ${i + 1} up`} disabled={i === 0} onClick={() => move(i, -1)}>
                        <ArrowUp />
                      </Button>
                      <Button variant="ghost" size="icon-xs" aria-label={`Move question ${i + 1} down`} disabled={i === items.length - 1} onClick={() => move(i, 1)}>
                        <ArrowDown />
                      </Button>
                    </div>
                  )}
                  {!locked && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Remove question ${i + 1}`}
                      onClick={() => setItems((xs) => xs.filter((x) => x.questionId !== it.questionId))}
                    >
                      <X />
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="px-5 py-12 text-center text-sm text-muted-foreground">Add questions from your bank on the right.</p>
        )}
        {invalid && <p className="px-5 pb-4 text-sm text-destructive">Each question needs whole or half marks greater than 0.</p>}
        {locked && <p className="px-5 pb-4 text-sm text-muted-foreground">The question list is locked because the exam is published.</p>}
      </Panel>

      {!locked && (
        <Panel className="lg:sticky lg:top-6 lg:self-start">
          <PanelHeader
            title="Your question bank"
            actions={
              <Link href="/examiner/bank/new" className={buttonVariants({ variant: "outline", size: "sm" })}>
                <Plus />
                New
              </Link>
            }
          />
          <div className="grid gap-2 border-b p-4 sm:grid-cols-[1fr_auto_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input aria-label="Search bank" placeholder="Search" className="pl-8" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <NativeSelect aria-label="Topic" value={topic} onChange={(e) => setTopic(e.target.value)}>
              <option value="">All topics</option>
              {topics.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </NativeSelect>
            <NativeSelect aria-label="Difficulty" value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
              <option value="">All levels</option>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </NativeSelect>
          </div>
          <ul className="max-h-[60vh] divide-y overflow-y-auto">
            {visibleBank.map((b) => {
              const isIn = chosen.has(b.questionId)
              return (
                <li key={b.questionId} className="flex items-start gap-3 px-5 py-3">
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <p className="line-clamp-2 text-sm">{b.stem}</p>
                    <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                      <TypeBadge type={b.type} />
                      <DifficultyBadge difficulty={b.difficulty} />
                      {b.topicName && <span>{b.topicName}</span>}
                      <span>· {fmtMarks(b.marks)} marks</span>
                    </div>
                  </div>
                  <Button
                    variant={isIn ? "ghost" : "outline"}
                    size="sm"
                    disabled={isIn}
                    onClick={() => add(b)}
                    aria-label={isIn ? "Already added" : `Add question: ${b.stem.slice(0, 40)}`}
                  >
                    {isIn ? <Check /> : <Plus />}
                    {isIn ? "Added" : "Add"}
                  </Button>
                </li>
              )
            })}
            {!visibleBank.length && <li className="px-5 py-10 text-center text-sm text-muted-foreground">No questions match.</li>}
          </ul>
        </Panel>
      )}
    </div>
  )
}
