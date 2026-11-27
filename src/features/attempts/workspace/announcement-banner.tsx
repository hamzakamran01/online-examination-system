"use client"

import * as React from "react"
import { ChevronDown, Megaphone, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import type { Announcement } from "./use-attempt-runtime"

const time = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })

/** Non-blocking examiner announcements (C-3.6.2). Newest first; dismissing hides it on this device only. */
export function AnnouncementBanner({
  all,
  visible,
  onDismiss,
}: {
  all: Announcement[]
  visible: Announcement[]
  onDismiss: (id: string) => void
}) {
  const [expanded, setExpanded] = React.useState(false)
  if (!all.length) return null
  const latest = visible[0]

  return (
    <div className="mx-auto mt-4 max-w-7xl px-4 sm:px-6">
      <section aria-label="Announcements from your examiner" className="rounded-xl border border-info/30 bg-info-soft text-sm text-info-text">
        {latest ? (
          <div role="status" aria-live="polite" className="flex gap-3 p-4">
            <Megaphone className="mt-0.5 size-4 shrink-0" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="font-medium">
                Announcement from your examiner <span className="font-normal opacity-80">at {time(latest.createdAt)}</span>
              </p>
              <p className="whitespace-pre-wrap">{latest.body}</p>
            </div>
            <Button size="icon-sm" variant="ghost" className="shrink-0 text-info-text hover:bg-info/10" onClick={() => onDismiss(latest.id)} aria-label="Dismiss announcement">
              <X />
            </Button>
          </div>
        ) : null}
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          aria-expanded={expanded}
          className={cn(
            "flex w-full items-center gap-1.5 px-4 py-2 text-xs font-medium hover:bg-info/10 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
            latest && "border-t border-info/20"
          )}
        >
          {!latest && <Megaphone className="size-3.5" aria-hidden />}
          {expanded ? "Hide" : "Show"} all announcements ({all.length})
          <ChevronDown className={cn("size-3.5 transition-transform", expanded && "rotate-180")} aria-hidden />
        </button>
        {expanded && (
          <ol className="max-h-60 space-y-2 overflow-y-auto border-t border-info/20 p-4">
            {all.map((a) => (
              <li key={a.id}>
                <span className="text-xs opacity-80">{time(a.createdAt)}</span>
                <p className="whitespace-pre-wrap">{a.body}</p>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  )
}
