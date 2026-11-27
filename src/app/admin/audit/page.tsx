import type { Metadata } from "next"
import { requirePageRole } from "@/server/auth/guards"
import { listAudit } from "@/server/services/audit"
import { PageHeader, Panel } from "@/components/shell/page-header"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { fmtDateTime } from "@/lib/format"

export const metadata: Metadata = { title: "Audit log" }

const describe = (action: string) => action.replace(/[._]/g, " ")

export default async function AuditPage() {
  const actor = await requirePageRole("admin")
  const rows = await listAudit(actor)
  return (
    <>
      <PageHeader title="Audit log" description="Append-only record of sensitive actions: account changes, publishing, grading and time extensions." />
      <Panel>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-5">When</TableHead>
                <TableHead>Who</TableHead>
                <TableHead>Action</TableHead>
                <TableHead className="hidden pr-5 md:table-cell">Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="pl-5 whitespace-nowrap text-muted-foreground">{fmtDateTime(r.createdAt)}</TableCell>
                  <TableCell>{r.actorName ?? "System"}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">
                      {describe(r.action)}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden max-w-md truncate pr-5 font-mono text-xs text-muted-foreground md:table-cell">
                    {Object.keys(r.meta).length ? JSON.stringify(r.meta) : `${r.entityType} ${r.entityId.slice(0, 8)}`}
                  </TableCell>
                </TableRow>
              ))}
              {!rows.length && (
                <TableRow>
                  <TableCell colSpan={4} className="py-12 text-center text-muted-foreground">
                    Nothing recorded yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Panel>
    </>
  )
}
