import { redirect } from "next/navigation"
import { Logo } from "@/components/shell/logo"
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
    <main id="main" className="flex min-h-dvh flex-col items-center px-4 py-10 sm:py-16">
      <Logo className="mb-10" />
      <Panel className="w-full max-w-md space-y-5 p-6 sm:p-8">
        <div>
          <h1 className="font-display text-2xl font-semibold">Verify a result report</h1>
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
