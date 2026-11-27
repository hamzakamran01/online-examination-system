"use client"

import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { AlertCircle, ChevronDown, Loader2 } from "lucide-react"
import { authClient } from "@/lib/auth-client"
import { signInSchema, type SignInInput } from "@/lib/validation/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"

const DEMO = [
  { role: "Administrator", blurb: "Accounts, roles, platform overview, audit log", email: "admin@examvault.test", password: "Admin#2026" },
  { role: "Examiner", blurb: "Question bank, exams, grading, results, analytics", email: "examiner@examvault.test", password: "Examiner#2026" },
  { role: "Candidate", blurb: "Take an exam, see published results", email: "ayesha@examvault.test", password: "Candidate#2026" },
]

export function LoginForm({ next }: { next?: string }) {
  const [error, setError] = React.useState<string | null>(null)
  const form = useForm<SignInInput>({ resolver: zodResolver(signInSchema), defaultValues: { email: "", password: "" } })
  const { errors, isSubmitting } = form.formState

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null)
    const { data, error: err } = await authClient
      .signIn.email(values)
      .catch(() => ({ data: null, error: { status: 0, code: "NETWORK" } as { status: number; code?: string } }))
    if (err) {
      const code = (err as { code?: string }).code
      setError(
        err.status === 0
          ? "No connection to the server. Check your internet and try again."
          : err.status === 429
            ? "Too many attempts. Wait a minute and try again."
            : code === "INVALID_ORIGIN"
              ? "This address is not allowed to sign in. Open the app from its main URL and try again."
              : code === "FAILED_TO_CREATE_SESSION"
                ? "This account is deactivated. Contact your administrator."
                : code === "INVALID_EMAIL_OR_PASSWORD" || err.status === 401
                  ? "Email or password is incorrect."
                  : `We could not sign you in (error ${err.status}${code ? ` ${code}` : ""}). Try again shortly.`
      )
      return
    }
    // Full navigation: the new session cookie must reach every server component, and a
    // client-side replace followed by refresh can race the server redirect.
    const role = (data?.user as { role?: string } | undefined)?.role
    const home = role === "admin" ? "/admin/overview" : role === "examiner" ? "/examiner" : role === "candidate" ? "/candidate" : "/"
    window.location.replace(next ?? home)
  })

  return (
    <div className="flex flex-col gap-5">
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
        {error && (
          <div role="alert" className="flex gap-2 rounded-lg border border-danger/30 bg-danger-soft p-3 text-sm text-danger-text">
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
            {error}
          </div>
        )}
        <FieldGroup>
          <Field data-invalid={!!errors.email}>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <Input id="email" type="email" autoComplete="username" aria-invalid={!!errors.email} className="h-10" {...form.register("email")} />
            <FieldError errors={[errors.email]} />
          </Field>
          <Field data-invalid={!!errors.password}>
            <FieldLabel htmlFor="password">Password</FieldLabel>
            <Input id="password" type="password" autoComplete="current-password" aria-invalid={!!errors.password} className="h-10" {...form.register("password")} />
            <FieldError errors={[errors.password]} />
          </Field>
        </FieldGroup>
        <Button type="submit" className="h-10 w-full text-[0.95rem]" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="animate-spin" aria-hidden />}
          {isSubmitting ? "Signing in" : "Sign in"}
        </Button>
      </form>

      <details className="group/demo overflow-hidden rounded-xl border bg-surface-sunken/50">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-3.5 text-xs font-semibold text-muted-foreground marker:hidden [&::-webkit-details-marker]:hidden">
          Demo access
          <span className="flex items-center gap-2 font-normal text-subtle-foreground">
            Fictional accounts
            <ChevronDown className="size-4 transition-transform group-open/demo:rotate-180" aria-hidden />
          </span>
        </summary>
        <div className="border-t bg-surface">
          <p className="px-3.5 py-2.5 text-xs leading-5 text-muted-foreground">Choose a role to fill the form with a demo account.</p>
          <ul className="divide-y">
            {DEMO.map((d) => (
              <li key={d.email}>
                <button
                  type="button"
                  onClick={() => {
                    form.setValue("email", d.email)
                    form.setValue("password", d.password)
                    form.clearErrors()
                  }}
                  className="group flex min-h-12 w-full items-center gap-3 px-3.5 py-2 text-left transition-colors hover:bg-surface-sunken focus-visible:bg-surface-sunken"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{d.role}</span>
                    <span className="block truncate text-xs text-muted-foreground">{d.blurb}</span>
                  </span>
                  <span className="rounded-md border bg-surface px-2 py-0.5 text-xs font-medium text-brand-text shadow-xs transition-colors group-hover:border-brand/40">Use</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </details>
    </div>
  )
}
