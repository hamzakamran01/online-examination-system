import { verifyReport } from "@/features/reports/verify"
import { PageHeader, Panel } from "@/components/shell/page-header"
import { fmtDate, fmtMarks } from "@/lib/format"
export const dynamic = "force-dynamic"
export default async function Page({ params }: PageProps<"/verify/[code]">) {
  const r = await verifyReport((await params).code)
  return (
    <main id="main" className="mx-auto max-w-lg px-4 py-12">
      <PageHeader title={r?.status ?? "Not found"} />
      {r && (
        <Panel className="p-5">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
            <dt>Exam</dt>
            <dd>{r.title}</dd>
            <dt>Candidate</dt>
            <dd>{r.name}</dd>
            <dt>Score</dt>
            <dd>
              {fmtMarks(r.score)} / {fmtMarks(r.max)}
            </dd>
            <dt>Issued</dt>
            <dd>{fmtDate(r.issued)}</dd>
          </dl>
        </Panel>
      )}
    </main>
  )
}
