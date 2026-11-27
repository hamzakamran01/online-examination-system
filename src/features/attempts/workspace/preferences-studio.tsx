"use client"

import * as React from "react"
import { Flag } from "lucide-react"
import { cn } from "@/lib/utils"
import { Panel, PanelHeader } from "@/components/shell/page-header"
import type { Preferences } from "@/lib/validation/workspace"
import { PreferencesPanel } from "./preferences-panel"
import "./contrast.css"

/** Preferences with a live sample of the exam screen, so candidates know exactly what they will see. */
export function PreferencesStudio({ initial }: { initial: Preferences }) {
  const [prefs, setPrefs] = React.useState(initial)
  const scope = prefs.theme === "contrast" ? "contrast" : prefs.theme === "dark" ? "dark" : prefs.theme === "light" ? "light-scope" : ""
  const options = ["A database index", "A primary key", "A foreign key", "A view"]

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
      <Panel className="h-fit p-5">
        <h2 className="font-semibold">Display</h2>
        <PreferencesPanel value={prefs} onChange={setPrefs} />
      </Panel>

      <Panel className="overflow-hidden">
        <PanelHeader title="Preview" description="A sample question, rendered with your settings." />
        <div className={cn("bg-canvas p-5 text-foreground sm:p-8", scope)} style={{ fontSize: `${prefs.fontScale}%` }}>
          <div className={cn("grid gap-4", prefs.paletteSide === "left" ? "sm:grid-cols-[120px_minmax(0,1fr)]" : "sm:grid-cols-[minmax(0,1fr)_120px]")}>
            <div className={cn("rounded-xl border bg-surface", prefs.paletteSide === "left" && "sm:order-2")}>
              <div className="flex items-center gap-2 border-b px-5 py-3 text-[0.875em]">
                <span className="font-medium">Question 3</span>
                <span className="text-muted-foreground">of 12 · 2 marks</span>
              </div>
              <div className="px-5 py-5">
                <p className="mb-4 font-medium">Which structure speeds up lookups on a column at the cost of slower writes?</p>
                <ul className="flex flex-col gap-2">
                  {options.map((o, i) => (
                    <li key={o} className={cn("flex items-center gap-3 rounded-lg border px-3 py-2.5", i === 0 && "border-primary bg-brand-softer")}>
                      <span
                        className={cn(
                          "grid size-7 shrink-0 place-items-center rounded-full border text-[0.8em] font-semibold",
                          i === 0 ? "border-primary bg-primary text-primary-foreground" : "border-border-strong text-muted-foreground"
                        )}
                      >
                        {String.fromCharCode(65 + i)}
                      </span>
                      {o}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div className={cn("rounded-xl border bg-surface p-3", prefs.paletteSide === "left" && "sm:order-1")} aria-hidden>
              <div className="grid grid-cols-3 gap-1.5">
                {Array.from({ length: 12 }, (_, i) => (
                  <span
                    key={i}
                    className={cn(
                      "relative grid aspect-square place-items-center rounded-md border text-[0.7em] font-medium",
                      i < 2 ? "border-primary bg-primary text-primary-foreground" : i === 2 ? "ring-2 ring-foreground" : "border-dashed border-border-strong text-muted-foreground"
                    )}
                  >
                    {i + 1}
                    {i === 1 && <Flag className="absolute -top-1 -right-1 size-3 text-time-text" />}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <p className="mt-4 text-[0.8em] text-muted-foreground">
            {prefs.layout === "scroll" ? "All questions appear in one scrolling list." : "One question per page, with a palette to jump between them."}
          </p>
        </div>
      </Panel>
    </div>
  )
}
