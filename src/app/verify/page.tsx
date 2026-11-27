import { redirect } from "next/navigation"
import { Logo } from "@/components/shell/logo"
import { ContourLines, GuillocheBand } from "@/components/shell/decor"
import { Panel } from "@/components/shell/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field, FieldLabel, FieldDescription } from "@/components/ui/field"

export const metadata = { title: "Verify a report" }

export default async function Page({ searchParams }: PageProps<"/verify">) {
  const { code } = await searchParams
  const value = typeof code === "string" ? code.trim() : ""
  if (/^[A-Za-z0-9_-]{22}$/.test(value)) redirect("/verify/" + value)
  const invalid = code !== undefined
  return (
    <main id="main" className="relative isolate flex min-h-dvh flex-col items-center overflow-hidden px-4 py-10 sm:py-16">
      <div aria-hidden className="bg-glow pointer-events-none absolute inset-0 -z-10" />
      <div aria-hidden className="bg-grid pointer-events-none absolute inset-0 -z-10" />
      <Logo className="mb-10" />
      <Panel className="relative isolate w-full max-w-md space-y-5 overflow-hidden rounded-2xl p-6 pt-8 shadow-raised sm:p-8 sm:pt-10">
        <GuillocheBand className="absolute inset-x-0 top-0 h-3.5 text-brand-text/60" />
        <ContourLines lines={10} className="absolute inset-x-0 bottom-0 -z-10 h-28 w-full text-brand-text/[0.08]" />
        <div>
          <p className="eyebrow text-brand-text">Public verification</p>
          <h1 className="font-display mt-1.5 text-2xl font-semibold tracking-tight">Verify a result report</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">Scan the QR code on a report, or type the code printed beneath it.</p>
        </div>
        <form className="space-y-4" action="/verify">
          <Field>
            <FieldLabel htmlFor="report-code">Verification code</FieldLabel>
            <Input
              id="report-code"
              name="code"
              defaultValue={value.slice(0, 64)}
              required
              maxLength={64}
              autoCapitalize="none"
              className="h-11 font-mono"
              spellCheck={false}
              aria-invalid={invalid}
              aria-describedby={invalid ? "code-help code-error" : "code-help"}
            />
            <FieldDescription id="code-help">The code is printed under the QR code on the report.</FieldDescription>
            {invalid && (
              <p id="code-error" role="alert" className="text-sm text-danger-text">
                Enter the 22-character verification code shown on the report.
              </p>
            )}
          </Field>
          <Button type="submit" className="h-11 w-full">
            Verify report
          </Button>
        </form>
      </Panel>
    </main>
  )
}
