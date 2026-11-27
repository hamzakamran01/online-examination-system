import { redirect } from "next/navigation"
import { PageHeader, Panel } from "@/components/shell/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
export default async function Page({ searchParams }: PageProps<"/verify">) {
  const { code } = await searchParams
  if (typeof code === "string" && code.trim())
    redirect("/verify/" + (/^[\w-]{22}$/.test(code.trim()) ? code.trim() : "invalid"))
  return (
    <main id="main" className="mx-auto max-w-lg px-4 py-12">
      <PageHeader title="Verify a report" />
      <Panel className="p-5">
        <form className="space-y-4" action="/verify">
          <label>
            Verification code
            <Input name="code" required maxLength={64} autoCapitalize="none" spellCheck={false} />
          </label>
          <Button type="submit">Verify report</Button>
        </form>
      </Panel>
    </main>
  )
}
