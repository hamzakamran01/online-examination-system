import "server-only"
import { Document, Page, Text, View, Image as PdfImage, StyleSheet, renderToBuffer } from "@react-pdf/renderer"
import QRCode from "qrcode"
import type { ReactNode } from "react"
import type { ResultReport } from "@/server/services/reports"
import type { ExamAnalytics } from "@/server/services/analytics"
import { fmtDateTime, fmtMarks } from "@/lib/format"
const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, color: "#18253c", fontFamily: "Helvetica" },
  brand: { fontSize: 10, color: "#415e85", marginBottom: 8 },
  title: { fontSize: 21, marginBottom: 12 },
  row: { flexDirection: "row", paddingVertical: 5, borderBottomWidth: 0.5, borderColor: "#acb9cb" },
  cell: { flex: 1, paddingRight: 4 },
  heading: { fontSize: 14, marginTop: 16, marginBottom: 5 },
  line: { marginBottom: 4 },
})
function Sheet({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Document title={title}>
      <Page size="A4" style={styles.page}>
        <Text style={styles.brand}>ExamVault</Text>
        <Text style={styles.title}>{title}</Text>
        {children}
        <Text
          fixed
          style={{ position: "absolute", bottom: 18, right: 40, fontSize: 9 }}
          render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
        />
      </Page>
    </Document>
  )
}
function Row({ values }: { values: (string | number)[] }) {
  return (
    <View wrap={false} style={styles.row}>
      {values.map((v, i) => (
        <Text key={i} style={styles.cell}>
          {v}
        </Text>
      ))}
    </View>
  )
}
export async function resultPdf(r: ResultReport) {
  const host =
    process.env.BETTER_AUTH_URL ||
    (process.env.VERCEL_URL ? "https://" + process.env.VERCEL_URL : "http://localhost:3000")
  const qr = await QRCode.toDataURL(new URL("/verify/" + r.code, host).href)
  return renderToBuffer(
    <Sheet title="Candidate result">
      <Text style={styles.heading}>{r.title}</Text>
      <Text style={styles.line}>{r.name}</Text>
      <Text>Submitted {fmtDateTime(r.submitted)}</Text>
      <Text>Issued {fmtDateTime(r.issued)}</Text>
      <Text style={styles.heading}>
        {fmtMarks(r.score)} / {fmtMarks(r.max)} marks ({fmtMarks(r.max ? (100 * r.score) / r.max : 0)}%)
      </Text>
      <Text>
        {r.grading === "pending"
          ? "Grading pending"
          : r.passMark === null
            ? "Graded"
            : r.score >= r.passMark
              ? "Pass"
              : "Fail"}
      </Text>
      <Text style={styles.heading}>Question marks</Text>
      <Row values={["Number", "Type", "Awarded", "Maximum"]} />
      {r.items.map((item, i) => (
        <Row
          key={i}
          values={[i + 1, item.type, item.score === null ? "Pending" : fmtMarks(item.score), fmtMarks(item.max)]}
        />
      ))}
      <View wrap={false}>
        <Text style={styles.heading}>Report verification</Text>
        <Text>{r.code}</Text>
        <PdfImage src={qr} style={{ width: 90, height: 90 }} />
      </View>
    </Sheet>,
  )
}
export function examPdf({ exam, stats, candidates }: ExamAnalytics) {
  return renderToBuffer(
    <Sheet title="Exam summary">
      <Text style={styles.heading}>{exam.title}</Text>
      <Text>
        {fmtDateTime(exam.startsAt)} to {fmtDateTime(exam.endsAt)}
      </Text>
      <Text>
        {exam.durationMin} minutes | {fmtMarks(exam.totalMarks)} marks
      </Text>
      <Text style={styles.heading}>Performance</Text>
      <Text>Finalized attempts: {stats.count}</Text>
      {!!stats.count && (
        <>
          <Text>
            Mean: {fmtMarks(stats.mean)} Median: {fmtMarks(stats.median)}
          </Text>
          <Text>
            Highest: {fmtMarks(stats.high)} Lowest: {fmtMarks(stats.low)}
          </Text>
          {stats.passRate !== null && <Text>Pass rate: {fmtMarks(stats.passRate)}%</Text>}
        </>
      )}
      <Text style={styles.heading}>Candidate scores</Text>
      {candidates.length ? (
        <>
          <Row values={["Candidate", "Score", "Percent", "Status", "Grading"]} />
          {candidates.map((c) => (
            <Row
              key={c.id}
              values={[
                c.name,
                fmtMarks(c.score) + " / " + fmtMarks(c.max),
                fmtMarks(c.percent) + "%",
                c.status.replaceAll("_", " "),
                c.grading,
              ]}
            />
          ))}
        </>
      ) : (
        <Text>No finalized attempts.</Text>
      )}
    </Sheet>,
  )
}
export function attachment(bytes: Buffer, name: string) {
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${name}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  })
}
