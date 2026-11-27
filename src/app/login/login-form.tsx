"use client"

import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { AlertCircle, Loader2 } from "lucide-react"
import { authClient } from "@/lib/auth-client"
import { signInSchema, type SignInInput } from "@/lib/validation/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"

const DEMO = [
  { role: "Administrator", email: "admin@examvault.test", password: "Admin#2026" },
  { role: "Examiner", email: "examiner@examvault.test", password: "Examiner#2026" },
  { role: "Candidate", email: "ayesha@examvault.test", password: "Candidate#2026" },
]

export function LoginForm({ next }: { next?: string }) {
  const router = useRouter()
  const [error, setError] = React.useState<string | null>(null)
  const form = useForm<SignInInput>({ resolver: zodResolver(signInSchema), defaultValues: { email: "", password: "" } })
  const { errors, isSubmitting } = form.formState

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null)
    const { error: err } = await authClient.signIn.email(values)
    if (err) {
      setError(
        err.status === 429
          ? "Too many attempts. Wait a minute and try again."
          : err.status === 401 || err.status === 403
            ? "Email or password is incorrect, or the account is deactivated."
            : "We could not sign you in. Check your connection and try again."
      )
      return
    }
    router.replace(next ?? "/")
    router.refresh()
  })

  return (
    <div className="space-y-8">
      <form onSubmit={onSubmit} noValidate className="space-y-5">
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
        <Button type="submit" className="h-10 w-full" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="animate-spin" aria-hidden />}
          {isSubmitting ? "Signing in" : "Sign in"}
        </Button>
      </form>

      <div className="space-y-3 rounded-xl border border-dashed p-4">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Demo accounts (fictional data)</p>
        <div className="grid gap-2 sm:grid-cols-3">
          {DEMO.map((d) => (
            <Button
              key={d.email}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                form.setValue("email", d.email)
                form.setValue("password", d.password)
                form.clearErrors()
              }}
            >
              {d.role}
            </Button>
          ))}
        </div>
      </div>
    </div>
  )
}
