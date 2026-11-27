"use client"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { NativeSelect } from "@/components/shell/common"
import { Panel, PanelHeader } from "@/components/shell/page-header"
import { importSchema, type Outcome, type Upload } from "@/lib/validation/imports"

function downloadErrors(rows: Outcome["rows"]) {
  const lines = rows.flatMap((r) => r.errors.map((error) => [String(r.line), error]))
  const csv = [["Line", "Error"], ...lines]
    .map((cells) => cells.map((s) => '"' + s.replaceAll('"', '""') + '"').join(","))
    .join("\r\n")
  const a = document.createElement("a")
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }))
  a.download = "import-errors.csv"
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}
export function ImportManager({ exams }: { exams: { id: string; title: string }[] }) {
  const [kind, setKind] = useState<Upload["kind"]>("candidates")
  const [examId, setExam] = useState("")
  const [file, setFile] = useState<File>()
  const [result, setResult] = useState<Outcome>()
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  function reset() {
    setError("")
    setResult(undefined)
    setDone(false)
  }
  async function process(commit: boolean) {
    if (!file) return
    setBusy(true)
    setError("")
    try {
      if (file.size > 1048576) throw Error("Choose a file up to 1 MB.")
      const input = importSchema.parse({
        kind,
        examId: (kind === "candidates" && examId) || undefined,
        source: await file.text(),
        format: file.name.split(".").pop()?.toLowerCase(),
      })
      const response = await fetch("/examiner/imports/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...input, commit }),
      })
      const body = await response.json()
      if (!response.ok) throw Error(body.error?.message || "Import request failed.")
      setResult(body)
      setDone(commit)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import request failed.")
    } finally {
      setBusy(false)
    }
  }
  const valid = result?.rows.filter((r) => !r.errors.length).length ?? 0
  return (
    <Panel>
      <PanelHeader title="Import file" description="CSV or JSON, up to 500 rows and 1 MB." />
      <div className="space-y-5 p-5">
        <div className="flex gap-2" aria-label="Import type">
          {(["candidates", "questions"] as const).map((k) => (
            <Button
              key={k}
              aria-pressed={k === kind}
              disabled={busy}
              variant={k === kind ? "default" : "outline"}
              onClick={() => {
                setKind(k)
                setFile(undefined)
                reset()
              }}
            >
              {k === "candidates" ? "Candidates" : "Questions"}
            </Button>
          ))}
        </div>
        <a className="text-primary underline" href={`/templates/${kind}.csv`} download>
          Download {kind} template
        </a>
        {kind === "candidates" && (
          <label className="block">
            Enroll candidates in
            <NativeSelect
              disabled={busy}
              value={examId}
              onChange={(e) => {
                setExam(e.target.value)
                reset()
              }}
            >
              <option value="">Create or reuse accounts only</option>
              {exams.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.title}
                </option>
              ))}
            </NativeSelect>
          </label>
        )}
        <label className="block rounded border border-dashed p-4">
          Choose a {kind} file
          <input
            key={kind}
            className="mt-2 block w-full"
            type="file"
            accept=".csv,.json"
            disabled={busy}
            onChange={(e) => {
              setFile(e.target.files?.[0])
              reset()
            }}
          />
        </label>
        <Button disabled={!file || busy || done} onClick={() => process(false)}>
          Preview file
        </Button>
        {busy && <p role="status">Processing file...</p>}
        {error && <p role="alert">{error}</p>}
        {result && (
          <>
            <p role="status">
              {valid} valid, {result.rows.length - valid} with errors{done && `. Imported ${result.imported} rows.`}
            </p>
            {!result.rows.length && <p>The file contains no data rows.</p>}
            <div className="max-h-96 overflow-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr>
                    <th>Line</th>
                    <th>Parsed values</th>
                    <th>Validation</th>
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((row) => (
                    <tr className="border-t" key={row.line}>
                      <td>{row.line}</td>
                      <td className="p-2 break-words">{row.values}</td>
                      <td>{row.errors.join(" / ") || "Valid"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                disabled={valid === result.rows.length}
                onClick={() => downloadErrors(result.rows)}
              >
                Download error report (CSV)
              </Button>
              {!done && (
                <Button disabled={!valid || busy} onClick={() => process(true)}>
                  Import {valid} valid rows
                </Button>
              )}
            </div>
            {!!result.passwords.length && (
              <>
                <h3>Generated passwords</h3>
                <p>Copy these before leaving this preview.</p>
                <table>
                  <tbody>
                    {result.passwords.map((p) => (
                      <tr key={p.email}>
                        <td>{p.email}</td>
                        <td>
                          <code>{p.password}</code>
                        </td>
                        <td>
                          <Button
                            variant="outline"
                            onClick={() =>
                              navigator.clipboard
                                .writeText(p.password)
                                .catch(() => setError("Select the password and copy it manually."))
                            }
                          >
                            Copy
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </>
        )}
      </div>
    </Panel>
  )
}
