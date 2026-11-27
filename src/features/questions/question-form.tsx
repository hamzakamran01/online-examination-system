"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useFieldArray, useForm, type Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { CheckCircle2, Circle, Plus, Square, SquareCheck, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field"
import { Panel } from "@/components/shell/page-header"
import { NativeSelect, useAction } from "@/components/shell/common"
import { questionSchema, type QuestionData, type QuestionInput } from "@/lib/validation/questions"
import { saveQuestionAction } from "./actions"

const TYPES = [
  { value: "single", title: "Single answer", body: "One correct option" },
  { value: "multi", title: "Multiple select", body: "One or more correct options" },
  { value: "written", title: "Written", body: "Graded manually" },
] as const

export function QuestionForm({ initial, topics }: { initial?: QuestionData; topics: string[] }) {
  const router = useRouter()
  const { run, pending } = useAction()
  const form = useForm<QuestionInput, unknown, QuestionData>({
    resolver: zodResolver(questionSchema) as Resolver<QuestionInput, unknown, QuestionData>,
    defaultValues: initial ?? {
      type: "single",
      stem: "",
      topicName: "",
      difficulty: "medium",
      defaultMarks: 1,
      multiScheme: "all_or_nothing",
      rubric: "",
      options: [
        { text: "", isCorrect: true },
        { text: "", isCorrect: false },
        { text: "", isCorrect: false },
        { text: "", isCorrect: false },
      ],
    },
  })
  const options = useFieldArray({ control: form.control, name: "options" })
  const type = form.watch("type")
  const e = form.formState.errors
  const optionsError = (e.options as { message?: string; root?: { message?: string } } | undefined)

  const changeType = (next: QuestionData["type"]) => {
    form.setValue("type", next)
    if (next === "written") options.replace([])
    else if (!form.getValues("options")?.length)
      options.replace([
        { text: "", isCorrect: true },
        { text: "", isCorrect: false },
      ])
    else if (next === "single") {
      const opts = form.getValues("options") ?? []
      const first = opts.findIndex((o) => o.isCorrect)
      options.replace(opts.map((o, i) => ({ ...o, isCorrect: i === Math.max(first, 0) })))
    }
    form.clearErrors("options")
  }

  const toggleCorrect = (index: number) => {
    const opts = form.getValues("options") ?? []
    form.setValue(
      "options",
      opts.map((o, i) => ({ ...o, isCorrect: type === "single" ? i === index : i === index ? !o.isCorrect : o.isCorrect })),
      { shouldValidate: form.formState.isSubmitted }
    )
  }

  return (
    <form
      noValidate
      onSubmit={form.handleSubmit(async (values) => {
        const r = await run(() => saveQuestionAction(values), { refresh: false })
        if (r.ok) {
          router.push("/examiner/bank")
          router.refresh()
        }
      })}
      className="space-y-6"
    >
      <Panel className="p-5 sm:p-6">
        <FieldGroup>
          <FieldSet>
            <FieldLegend>Question type</FieldLegend>
            <div role="radiogroup" aria-label="Question type" className="grid gap-2 sm:grid-cols-3">
              {TYPES.map((t) => (
                <label
                  key={t.value}
                  className={cn(
                    "flex cursor-pointer gap-3 rounded-lg border p-3 transition-colors has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
                    type === t.value ? "border-primary bg-brand-softer" : "hover:bg-muted/50"
                  )}
                >
                  <input
                    type="radio"
                    name="qtype"
                    value={t.value}
                    checked={type === t.value}
                    onChange={() => changeType(t.value)}
                    className="mt-1 accent-[var(--primary)]"
                    disabled={Boolean(initial?.id)}
                  />
                  <span>
                    <span className="block text-sm font-medium">{t.title}</span>
                    <span className="block text-xs text-muted-foreground">{t.body}</span>
                  </span>
                </label>
              ))}
            </div>
            {initial?.id && <FieldDescription>The type of an existing question cannot change. Duplicate it instead.</FieldDescription>}
          </FieldSet>

          <Field data-invalid={!!e.stem}>
            <FieldLabel htmlFor="stem">Question</FieldLabel>
            <Textarea id="stem" rows={4} aria-invalid={!!e.stem} {...form.register("stem")} />
            <FieldError errors={[e.stem]} />
          </Field>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field data-invalid={!!e.topicName}>
              <FieldLabel htmlFor="topic">Topic</FieldLabel>
              <Input id="topic" list="topic-list" placeholder="e.g. Databases" {...form.register("topicName")} />
              <datalist id="topic-list">
                {topics.map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
              <FieldError errors={[e.topicName]} />
            </Field>
            <Field>
              <FieldLabel htmlFor="difficulty">Difficulty</FieldLabel>
              <NativeSelect id="difficulty" {...form.register("difficulty")}>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </NativeSelect>
            </Field>
            <Field data-invalid={!!e.defaultMarks}>
              <FieldLabel htmlFor="marks">Default marks</FieldLabel>
              <Input id="marks" type="number" inputMode="decimal" step="0.5" min="0.5" aria-invalid={!!e.defaultMarks} {...form.register("defaultMarks")} />
              <FieldError errors={[e.defaultMarks]} />
            </Field>
          </div>
        </FieldGroup>
      </Panel>

      {type !== "written" ? (
        <Panel className="p-5 sm:p-6">
          <FieldSet>
            <FieldLegend>Options</FieldLegend>
            <FieldDescription>
              {type === "single" ? "Select the one correct option." : "Select every correct option."} Order is shuffled per candidate when the exam allows it.
            </FieldDescription>
            <ul className="space-y-2">
              {options.fields.map((f, i) => {
                const correct = form.watch(`options.${i}.isCorrect`)
                const Icon = type === "single" ? (correct ? CheckCircle2 : Circle) : correct ? SquareCheck : Square
                return (
                  <li key={f.id} className={cn("flex items-start gap-2 rounded-lg border p-2", correct && "border-success/50 bg-success-soft/40")}>
                    <button
                      type="button"
                      onClick={() => toggleCorrect(i)}
                      aria-pressed={correct}
                      aria-label={`Mark option ${i + 1} as ${correct ? "incorrect" : "correct"}`}
                      className={cn("mt-1.5 rounded p-0.5", correct ? "text-success-text" : "text-muted-foreground hover:text-foreground")}
                    >
                      <Icon className="size-5" />
                    </button>
                    <div className="flex-1">
                      <Input
                        aria-label={`Option ${i + 1} text`}
                        placeholder={`Option ${i + 1}`}
                        aria-invalid={!!e.options?.[i]?.text}
                        {...form.register(`options.${i}.text`)}
                      />
                      <FieldError errors={[e.options?.[i]?.text]} className="mt-1" />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="mt-0.5"
                      disabled={options.fields.length <= 2}
                      onClick={() => options.remove(i)}
                      aria-label={`Remove option ${i + 1}`}
                    >
                      <Trash2 />
                    </Button>
                  </li>
                )
              })}
            </ul>
            <FieldError>{optionsError?.message ?? optionsError?.root?.message}</FieldError>
            <div>
              <Button type="button" variant="outline" size="sm" disabled={options.fields.length >= 8} onClick={() => options.append({ text: "", isCorrect: false })}>
                <Plus />
                Add option
              </Button>
            </div>
          </FieldSet>

          {type === "multi" && (
            <FieldSet className="mt-6">
              <FieldLegend>Marking scheme</FieldLegend>
              <div className="grid gap-2 sm:grid-cols-2">
                {(
                  [
                    ["all_or_nothing", "All or nothing", "Full marks only when the selection exactly matches the correct set."],
                    ["partial", "Partial credit", "Each correct choice earns a share; each wrong choice removes a share. Never below 0."],
                  ] as const
                ).map(([value, title, body]) => (
                  <label key={value} className="flex cursor-pointer gap-3 rounded-lg border p-3 has-checked:border-primary has-checked:bg-brand-softer">
                    <input type="radio" value={value} className="mt-1 accent-[var(--primary)]" {...form.register("multiScheme")} />
                    <span>
                      <span className="block text-sm font-medium">{title}</span>
                      <span className="block text-xs text-muted-foreground">{body}</span>
                    </span>
                  </label>
                ))}
              </div>
            </FieldSet>
          )}
        </Panel>
      ) : (
        <Panel className="p-5 sm:p-6">
          <Field data-invalid={!!e.rubric}>
            <FieldLabel htmlFor="rubric">Grading rubric (examiner only)</FieldLabel>
            <Textarea id="rubric" rows={4} placeholder="What earns full marks? Break it down so grading is consistent." {...form.register("rubric")} />
            <FieldDescription>Shown to graders next to each answer. Never shown to candidates.</FieldDescription>
            <FieldError errors={[e.rubric]} />
          </Field>
        </Panel>
      )}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {initial?.id ? "Save changes" : "Add to bank"}
        </Button>
      </div>
    </form>
  )
}
