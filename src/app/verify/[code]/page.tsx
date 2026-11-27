import { Award } from "lucide-react"
import { verifyReport } from "@/features/reports/verify"
import { Logo } from "@/components/shell/logo"
import { fmtDate, fmtMarks } from "@/lib/format"

export const dynamic = "force-dynamic"

export default async function Page({ params }: PageProps<"/verify/[code]">) {
  const r = await verifyReport((await params).code)
  return (
    <main id="main" className="mx-auto max-w-lg px-4 py-12">
      <Logo className="mb-8" />
      <p className="kicker mb-3">Public registry</p>
      <h1 className="font-heading mb-2 text-3xl font-medium tracking-tight">{r?.status ?? "Not found"}</h1>
      <p className="mb-8 text-sm text-muted-foreground">
        {r ? "This report matches a record in ExamVault. Only the fields needed to confirm authenticity are shown." : "No matching report. Check the code and try again."}
      </p>
      {r && (
        <section className="certificate rounded-lg bg-paper p-6 sm:p-8">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <p className="kicker text-seal-text">Authentic record</p>
              <p className="font-heading mt-1 text-xl font-medium">{r.title}</p>
            </div>
            <span className="seal-disc shrink-0" aria-hidden>
              <Award className="size-6" />
            </span>
          </div>
          <dl className="ledger text-sm">
            <dt>Candidate</dt>
            <dd className="font-medium">{r.name}</dd>
            <dt>Score</dt>
            <dd className="font-heading text-lg font-medium tabular-nums">
              {fmtMarks(r.score)} / {fmtMarks(r.max)}
            </dd>
            <dt>Issued</dt>
            <dd>{fmtDate(r.issued)}</dd>
          </dl>
        </section>
      )}
    </main>
  )
}
