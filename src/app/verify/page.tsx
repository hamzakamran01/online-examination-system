import { redirect } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Logo } from "@/components/shell/logo"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"

export default async function Page({ searchParams }: PageProps<"/verify">) {
  const { code } = await searchParams
  if (typeof code === "string" && code.trim())
    redirect("/verify/" + (/^[\w-]{22}$/.test(code.trim()) ? code.trim() : "invalid"))
  return (
    <main id="main" className="mx-auto max-w-lg px-4 py-12">
      <Logo className="mb-8" />
      <p className="kicker mb-3">Public registry</p>
      <h1 className="font-heading mb-2 text-3xl font-medium tracking-tight">Verify a report</h1>
      <p className="mb-8 text-sm text-muted-foreground">
        Enter the code printed on an ExamVault result. We show only the minimum needed to confirm it is genuine.
      </p>
      <section className="certificate rounded-lg bg-paper p-5 sm:p-6">
        <form className="flex flex-col gap-4" action="/verify">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="code">Verification code</FieldLabel>
              <Input id="code" name="code" required maxLength={64} autoCapitalize="none" spellCheck={false} className="font-mono" />
            </Field>
          </FieldGroup>
          <Button type="submit" size="lg">
            Verify report
          </Button>
        </form>
      </section>
    </main>
  )
}
