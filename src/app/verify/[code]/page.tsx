import Link from "next/link"
import { ArrowLeft, FileQuestion, ShieldAlert, ShieldCheck } from "lucide-react"
import { verifyReport } from "@/features/reports/verify"
import { Logo } from "@/components/shell/logo"
import { fmtDate, fmtMarks } from "@/lib/format"
import { cn } from "@/lib/utils"

export const metadata = { title: "Report verification" }
export const dynamic = "force-dynamic"

/** Public certificate check (S-4.6). Shows the minimum: status, exam, shortened name, score, issue date. */
export default async function Page({ params }: PageProps<"/verify/[code]">) {
  const { code } = await params
  const r = await verifyReport(code)
  const valid = r?.status === "Valid"
  const state = valid ? "valid" : r ? "replaced" : "missing"
  const copy = {
    valid: { icon: ShieldCheck, title: "Authentic report", body: "This result report was issued by ExamVault and has not been changed.", tone: "text-success-text", ring: "bg-success-soft" },
    replaced: {
      icon: ShieldAlert,
      title: "Replaced by a newer report",
      body: "This code belonged to an earlier version, for example before a regrade. Ask the candidate for their latest report.",
      tone: "text-time-text",
      ring: "bg-time-soft",
    },
    missing: { icon: FileQuestion, title: "No report matches this code", body: "Check the code printed under the QR code and try again.", tone: "text-muted-foreground", ring: "bg-muted" },
  }[state]
  const Icon = copy.icon

  return (
    <main id="main" className="flex min-h-dvh flex-col items-center px-4 py-10 sm:py-16">
      <Logo className="mb-10" />
      <article className="w-full max-w-md overflow-hidden rounded-xl border bg-surface" aria-labelledby="verify-title">
        <div className="flex flex-col items-center px-6 pt-8 pb-6 text-center">
          <span className={cn("grid size-14 place-items-center rounded-full", copy.ring)}>
            <Icon className={cn("size-7", copy.tone)} aria-hidden />
          </span>
          <h1 id="verify-title" className="font-display mt-4 text-2xl font-semibold">
            {copy.title}
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">{copy.body}</p>
        </div>

        {r && (
          <dl className="divide-y border-t text-sm">
            {[
              ["Examination", r.title],
              ["Candidate", r.name],
              ["Score", `${fmtMarks(r.score)} / ${fmtMarks(r.max)}`],
              ["Issued", fmtDate(r.issued)],
            ].map(([k, v]) => (
              <div key={k} className="flex items-baseline justify-between gap-4 px-6 py-3">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className={cn("text-right font-medium break-words", k === "Score" && "font-display text-lg tabular-nums")}>{v}</dd>
              </div>
            ))}
          </dl>
        )}

        <div className="border-t bg-surface-sunken px-6 py-4">
          <p className="text-xs text-muted-foreground">
            Code <span className="font-mono text-foreground">{code}</span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">For privacy, this page shows only the exam, a shortened name, the score and the issue date.</p>
        </div>
      </article>
      <Link href="/verify" className="mt-6 inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-brand-text hover:underline">
        <ArrowLeft className="size-4" aria-hidden />
        Verify another code
      </Link>
    </main>
  )
}
