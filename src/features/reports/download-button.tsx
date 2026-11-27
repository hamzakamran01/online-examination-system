"use client"
import { useState } from "react"
import { Button } from "@/components/ui/button"
export function DownloadReportButton({ kind, id }: { kind: "attempt" | "exam"; id: string }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("")
  async function download() {
    setBusy(true)
    setError("")
    try {
      const r = await fetch(`/api/reports/${kind}/${encodeURIComponent(id)}`)
      if (!r.ok) throw Error((await r.json()).error?.message || "Download failed.")
      const a = document.createElement("a")
      a.href = URL.createObjectURL(await r.blob())
      a.download = kind + "-" + id + ".pdf"
      a.click()
      setTimeout(() => URL.revokeObjectURL(a.href), 1000)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Download failed.")
    } finally {
      setBusy(false)
    }
  }
  return (
    <div>
      <Button onClick={download} disabled={busy}>
        {busy ? "Preparing PDF..." : "Download PDF"}
      </Button>
      {error && <p role="alert">{error}</p>}
    </div>
  )
}
