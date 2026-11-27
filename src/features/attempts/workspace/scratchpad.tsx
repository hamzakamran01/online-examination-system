"use client"
import { useEffect, useId, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ConfirmAction } from "@/components/shell/common"
import { Panel } from "@/components/shell/page-header"
import { scratchSchema } from "@/lib/validation/workspace"

export function Scratchpad(props: { attemptId: string; initial: string }) {
  return <AttemptNotes key={props.attemptId} {...props} />
}
function AttemptNotes({ attemptId, initial }: { attemptId: string; initial: string }) {
  const [open, setOpen] = useState(false),
    [text, setText] = useState(initial),
    [status, setStatus] = useState("Saved")
  const [locked, setLocked] = useState(false)
  const inputId = useId(),
    panelId = useId()
  const initialText = useRef(initial)
  const edit = useRef<(value: string) => void>(() => {})
  useEffect(() => {
    const key = "ev:scratch:" + attemptId
    let draft = initialText.current,
      dirty = false,
      active = true,
      pending = false,
      closed = false,
      storageAvailable = true
    let timer: ReturnType<typeof setTimeout>
    function schedule(delay: number) {
      clearTimeout(timer)
      if (active && !closed) timer = setTimeout(flush, delay)
    }
    async function flush() {
      if (!active || pending || closed) return
      if (!navigator.onLine) {
        setStatus(storageAvailable ? "Offline, draft saved on this device" : "Offline, device storage unavailable")
        return
      }
      const sending = draft
      if (!dirty) {
        setStatus("Saved")
        return
      }
      let retry = 1000
      pending = true
      setStatus("Saving...")
      try {
        const input = scratchSchema.parse({ attemptId, text: sending })
        const r = await fetch("/api/attempts/" + attemptId + "/scratchpad", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: input.text }),
        })
        if (!r.ok) {
          closed = [400, 401, 403, 404, 409].includes(r.status)
          if (closed && active) setLocked(true)
          throw Error((await r.json()).error?.message || "Save failed.")
        }
        dirty = draft !== sending
        if (active && draft === sending) {
          try {
            if (localStorage.getItem(key) === sending) localStorage.removeItem(key)
          } catch {}
          setStatus("Saved")
        }
      } catch (e) {
        retry = 5000
        if (active)
          setStatus(
            closed && e instanceof Error
              ? e.message
              : storageAvailable
                ? "Offline or save failed, draft kept on this device"
                : "Save failed, device storage unavailable",
          )
      } finally {
        pending = false
        if (active && dirty && !closed) schedule(retry)
      }
    }
    edit.current = (value) => {
      if (closed) return
      draft = value
      dirty = true
      setText(value)
      try {
        localStorage.setItem(key, value)
        storageAvailable = true
      } catch {
        storageAvailable = false
      }
      setStatus(
        navigator.onLine
          ? "Saving..."
          : storageAvailable
            ? "Offline, draft saved on this device"
            : "Offline, device storage unavailable",
      )
      schedule(1000)
    }
    queueMicrotask(() => {
      if (!active) return
      try {
        const cached = localStorage.getItem(key)
        if (cached !== null && cached.length <= 20000 && cached !== draft) {
          edit.current(cached)
          return
        }
      } catch {
        storageAvailable = false
      }
      if (!navigator.onLine) setStatus("Offline")
    })
    function reconnect() {
      schedule(0)
    }
    function offline() {
      if (active) setStatus("Offline")
    }
    function shortcut(e: KeyboardEvent) {
      if (e.altKey && !e.ctrlKey && e.code === "KeyS") {
        e.preventDefault()
        setOpen((v) => !v)
      }
    }
    window.addEventListener("online", reconnect)
    window.addEventListener("offline", offline)
    window.addEventListener("keydown", shortcut)
    return () => {
      active = false
      clearTimeout(timer)
      window.removeEventListener("online", reconnect)
      window.removeEventListener("offline", offline)
      window.removeEventListener("keydown", shortcut)
    }
  }, [attemptId])
  return (
    <Panel className="space-y-3 p-4">
      <Button
        variant="outline"
        aria-keyshortcuts="Alt+S"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen(!open)}
      >
        Scratchpad (Alt+S)
      </Button>
      <div id={panelId} hidden={!open} className="space-y-2">
        <label htmlFor={inputId}>Rough work</label>
        <p className="text-sm text-muted-foreground">Your scratchpad is never graded.</p>
        <Textarea
          id={inputId}
          rows={6}
          maxLength={20000}
          disabled={locked}
          value={text}
          onChange={(e) => edit.current(e.target.value)}
        />
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span role="status">{status}</span>
          <span>{text.length.toLocaleString()} / 20,000 characters</span>
          <ConfirmAction
            trigger={(show) => (
              <Button variant="outline" disabled={locked || !text} onClick={show}>
                Clear
              </Button>
            )}
            title="Clear scratchpad?"
            description="All rough work for this attempt will be cleared."
            confirmLabel="Clear scratchpad"
            destructive
            onConfirm={async () => edit.current("")}
          />
        </div>
      </div>
    </Panel>
  )
}
