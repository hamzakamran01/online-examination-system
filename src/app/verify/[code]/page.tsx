import Link from "next/link"
import { ShieldCheck } from "lucide-react"
import { verifyReport } from "@/features/reports/verify"
import { Logo } from "@/components/shell/logo"
import { Panel } from "@/components/shell/page-header"
import { fmtDate, fmtMarks } from "@/lib/format"

export const metadata = { title: "Report verification" }
export const dynamic = "force-dynamic"

export default async function Page({ params }: PageProps<"/verify/[code]">) {
  const r = await verifyReport((await params).code)
  const valid = r?.status === "Valid"
  return (
    <main id="main" className="mx-auto max-w-lg px-4 py-12">
      <Panel className="space-y-5 p-5 sm:p-7">
        <Logo />
        <div
          className={`rounded-lg p-4 ${valid ? "bg-success-soft text-success-text" : r ? "bg-warning-soft text-warning-text" : "bg-muted text-foreground"}`}
        >
          {valid && <ShieldCheck className="mb-2 size-7" aria-hidden />}
          <h1 className="text-2xl font-semibold">{r?.status ?? "Not found"}</h1>
          <p>
            {valid
              ? "This result report is authentic"
              : r
                ? "This report was replaced by a newer version (for example after a regrade)"
                : "No report matches this code. Check the code and try again."}
          </p>
        </div>
        {r && (
          <>
            <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm [&_dt]:font-medium [&_dt]:text-muted-foreground">
              <dt>Exam</dt>
              <dd className="break-words">{r.title}</dd>
              <dt>Candidate</dt>
              <dd className="break-words">{r.name}</dd>
              <dt>Score</dt>
              <dd>
                {fmtMarks(r.score)} / {fmtMarks(r.max)}
              </dd>
              <dt>Issued</dt>
              <dd>{fmtDate(r.issued)}</dd>
            </dl>
            <p className="text-sm text-muted-foreground">
              For privacy this page shows only the exam, a shortened name, the score and the issue date.
            </p>
          </>
        )}
        <Link
          href="/verify"
          className="inline-flex min-h-11 items-center rounded text-sm font-medium text-primary underline"
        >
          Verify another code
        </Link>
      </Panel>
    </main>
  )
}
