"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useForm, type Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Field, FieldContent, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field"
import { Panel } from "@/components/shell/page-header"
import { useAction } from "@/components/shell/common"
import { examSchema, type ExamData } from "@/lib/validation/exams"
import { toLocalInput } from "@/lib/format"
import { createExamAction, updateExamAction } from "./actions"

/** Form values keep browser-local datetime strings; they become ISO before validation. */
type FormValues = {
  id?: string
  title: string
  instructions: string
  startsAt: string
  endsAt: string
  durationMin: number | string
  totalMarks: number | string
  passMark: number | string
  shuffleQuestions: boolean
  shuffleOptions: boolean
  releaseAnswerReview: boolean
}

const toIso = (local: string) => {
  if (!local) return ""
  const d = new Date(local)
  return Number.isNaN(d.getTime()) ? "" : d.toISOString()
}

const resolver: Resolver<FormValues, unknown, ExamData> = async (values, ctx, opts) => {
  const zr = zodResolver(examSchema) as unknown as Resolver<FormValues, unknown, ExamData>
  return zr({ ...values, startsAt: toIso(values.startsAt), endsAt: toIso(values.endsAt) }, ctx, opts)
}

export type ExamFormInitial = Omit<ExamData, "startsAt" | "endsAt"> & { startsAt: string; endsAt: string }

export function ExamForm({ initial, disabled }: { initial?: ExamFormInitial; disabled?: boolean }) {
  const router = useRouter()
  const { run, pending } = useAction()
  const defaults = React.useMemo<FormValues>(() => {
    if (initial)
      return {
        ...initial,
        startsAt: toLocalInput(initial.startsAt),
        endsAt: toLocalInput(initial.endsAt),
        passMark: initial.passMark ?? "",
      }
    const start = new Date(Date.now() + 60 * 60 * 1000)
    start.setMinutes(0, 0, 0)
    return {
      title: "",
      instructions: "",
      startsAt: toLocalInput(start),
      endsAt: toLocalInput(new Date(start.getTime() + 2 * 60 * 60 * 1000)),
      durationMin: 60,
      totalMarks: 20,
      passMark: "",
      shuffleQuestions: true,
      shuffleOptions: true,
      releaseAnswerReview: false,
    }
  }, [initial])

  const form = useForm<FormValues, unknown, ExamData>({ resolver, defaultValues: defaults })
  const e = form.formState.errors

  const toggles = [
    ["shuffleQuestions", "Shuffle question order", "Each candidate receives the questions in a different order."],
    ["shuffleOptions", "Shuffle answer options", "Options of objective questions are shuffled per candidate. Marking is unaffected."],
    ["releaseAnswerReview", "Show correct answers with results", "After you publish results, candidates can see the correct options."],
  ] as const

  return (
    <form
      noValidate
      onSubmit={form.handleSubmit(async (values) => {
        const r = await run(() => (values.id ? updateExamAction(values) : createExamAction(values)), { refresh: false })
        if (r.ok) {
          const id = (r.data as { id: string }).id
          router.push(values.id ? `/examiner/exams/${id}` : `/examiner/exams/${id}/questions`)
          router.refresh()
        } else if (r.fields) for (const [k, m] of Object.entries(r.fields)) form.setError(k as keyof FormValues, { message: m })
      })}
      className="space-y-6"
    >
      <fieldset disabled={disabled} className="space-y-6">
        <Panel className="p-5 sm:p-6">
          <FieldGroup>
            <Field data-invalid={!!e.title}>
              <FieldLabel htmlFor="title">Title</FieldLabel>
              <Input id="title" aria-invalid={!!e.title} placeholder="e.g. Database Systems Final" {...form.register("title")} />
              <FieldError errors={[e.title]} />
            </Field>
            <Field data-invalid={!!e.instructions}>
              <FieldLabel htmlFor="instructions">Instructions for candidates</FieldLabel>
              <Textarea id="instructions" rows={5} placeholder="Rules, allowed materials, how marking works." {...form.register("instructions")} />
              <FieldDescription>Shown in the lobby before the candidate starts.</FieldDescription>
              <FieldError errors={[e.instructions]} />
            </Field>
          </FieldGroup>
        </Panel>

        <Panel className="p-5 sm:p-6">
          <FieldSet>
            <FieldLegend>Schedule and marks</FieldLegend>
            <FieldDescription>
              Candidates can start any time inside the window. Each attempt ends after the duration or when the window closes, whichever comes first. Time is kept by the server.
            </FieldDescription>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field data-invalid={!!e.startsAt}>
                <FieldLabel htmlFor="startsAt">Opens</FieldLabel>
                <Input id="startsAt" type="datetime-local" aria-invalid={!!e.startsAt} {...form.register("startsAt")} />
                <FieldError errors={[e.startsAt]} />
              </Field>
              <Field data-invalid={!!e.endsAt}>
                <FieldLabel htmlFor="endsAt">Closes</FieldLabel>
                <Input id="endsAt" type="datetime-local" aria-invalid={!!e.endsAt} {...form.register("endsAt")} />
                <FieldError errors={[e.endsAt]} />
              </Field>
              <Field data-invalid={!!e.durationMin}>
                <FieldLabel htmlFor="durationMin">Duration (minutes)</FieldLabel>
                <Input id="durationMin" type="number" min={1} inputMode="numeric" aria-invalid={!!e.durationMin} {...form.register("durationMin")} />
                <FieldError errors={[e.durationMin]} />
              </Field>
              <Field data-invalid={!!e.totalMarks}>
                <FieldLabel htmlFor="totalMarks">Total marks</FieldLabel>
                <Input id="totalMarks" type="number" min={0.5} step={0.5} inputMode="decimal" aria-invalid={!!e.totalMarks} {...form.register("totalMarks")} />
                <FieldDescription>Must equal the sum of question marks before publishing.</FieldDescription>
                <FieldError errors={[e.totalMarks]} />
              </Field>
              <Field data-invalid={!!e.passMark}>
                <FieldLabel htmlFor="passMark">Pass mark (optional)</FieldLabel>
                <Input id="passMark" type="number" min={0} step={0.5} inputMode="decimal" aria-invalid={!!e.passMark} {...form.register("passMark")} />
                <FieldError errors={[e.passMark]} />
              </Field>
            </div>
          </FieldSet>
        </Panel>

        <Panel className="p-5 sm:p-6">
          <FieldSet>
            <FieldLegend>Settings</FieldLegend>
            <FieldGroup className="gap-4">
              {toggles.map(([name, label, hint]) => (
                <Field key={name} orientation="horizontal">
                  <FieldContent>
                    <FieldLabel htmlFor={name}>{label}</FieldLabel>
                    <FieldDescription>{hint}</FieldDescription>
                  </FieldContent>
                  <Switch id={name} checked={form.watch(name)} onCheckedChange={(v) => form.setValue(name, v, { shouldDirty: true })} />
                </Field>
              ))}
            </FieldGroup>
          </FieldSet>
        </Panel>
      </fieldset>

      {!disabled && (
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" disabled={pending}>
            {initial?.id ? "Save settings" : "Create draft and add questions"}
          </Button>
        </div>
      )}
    </form>
  )
}
