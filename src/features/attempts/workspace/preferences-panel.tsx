"use client"
import { useState } from "react"
import { Panel, PanelHeader } from "@/components/shell/page-header"
import { NativeSelect } from "@/components/shell/common"
import { toast } from "sonner"
import { preferencesSchema, type Preferences } from "@/lib/validation/workspace"
import { savePreferencesAction } from "./workspace-actions"
import "./contrast.css"
export function applyPreferences(prefs: Preferences) {
  return {
    className:
      "workspace-theme-" +
      prefs.theme +
      (prefs.theme === "contrast" ? " contrast" : prefs.theme === "dark" ? " dark" : ""),
    style: { fontSize: prefs.fontScale + "%" },
    "data-layout": prefs.layout,
    "data-palette-side": prefs.paletteSide,
  }
}
export function PreferencesPanel({ value, onChange }: { value: Preferences; onChange: (p: Preferences) => void }) {
  const [busy, setBusy] = useState(false)
  async function change(input: Preferences) {
    const next = preferencesSchema.parse(input)
    setBusy(true)
    onChange(next)
    try {
      const r = await savePreferencesAction(next)
      if (!r.ok) throw Error(r.message)
    } catch (e) {
      onChange(value)
      toast.error(e instanceof Error ? e.message : "Preferences could not be saved.")
    } finally {
      setBusy(false)
    }
  }
  return (
    <Panel>
      <PanelHeader title="Workspace preferences" />
      <fieldset disabled={busy} className="grid gap-4 p-4 sm:grid-cols-2">
        <legend className="sr-only">Workspace preferences</legend>
        <label>
          Text size
          <NativeSelect
            value={value.fontScale}
            onChange={(e) => change({ ...value, fontScale: Number(e.target.value) as Preferences["fontScale"] })}
          >
            {[90, 100, 115, 130].map((n) => (
              <option key={n} value={n}>
                {n}%
              </option>
            ))}
          </NativeSelect>
        </label>
        <label>
          Theme
          <NativeSelect
            value={value.theme}
            onChange={(e) => change({ ...value, theme: e.target.value as Preferences["theme"] })}
          >
            {Object.entries({ system: "System", light: "Light", dark: "Dark", contrast: "High contrast" }).map(
              ([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ),
            )}
          </NativeSelect>
        </label>
        <label>
          Questions
          <NativeSelect
            value={value.layout}
            onChange={(e) => change({ ...value, layout: e.target.value as Preferences["layout"] })}
          >
            <option value="single">One question per page</option>
            <option value="scroll">All questions in a scrolling list</option>
          </NativeSelect>
        </label>
        <label>
          Question palette
          <NativeSelect
            value={value.paletteSide}
            onChange={(e) => change({ ...value, paletteSide: e.target.value as Preferences["paletteSide"] })}
          >
            <option value="left">Left</option>
            <option value="right">Right</option>
          </NativeSelect>
        </label>
      </fieldset>
      <p className="px-4 pb-3 text-sm" role="status">
        {busy ? "Saving..." : ""}
      </p>
    </Panel>
  )
}
