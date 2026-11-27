"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import { CornerDownLeft, LogOut, Moon, Search, Sun } from "lucide-react"
import { cn } from "@/lib/utils"
import { authClient } from "@/lib/auth-client"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { COMMANDS, NAV, type Role } from "./nav"

type Entry = { id: string; group: string; label: string; hint?: string; icon: React.ComponentType<{ className?: string }>; keywords?: string; run: () => void }

/**
 * Keyboard-first navigation (Ctrl/Cmd K). Lists only what the current role can
 * reach; permissions are still enforced on the server for every destination.
 */
export function CommandPalette({ role, open, onOpenChange }: { role: Role; open: boolean; onOpenChange: (o: boolean) => void }) {
  const router = useRouter()
  const { resolvedTheme, setTheme } = useTheme()
  const [query, setQuery] = React.useState("")
  const [active, setActive] = React.useState(0)
  const listRef = React.useRef<HTMLUListElement>(null)

  const entries = React.useMemo<Entry[]>(() => {
    const go = (href: string) => () => {
      onOpenChange(false)
      router.push(href)
    }
    return [
      ...NAV[role].flatMap((g) => g.items.map((i) => ({ id: i.href, group: "Go to", label: i.label, icon: i.icon, keywords: i.keywords, run: go(i.href) }))),
      ...COMMANDS[role].map((c) => ({ id: c.href + c.label, group: "Actions", label: c.label, icon: c.icon, keywords: c.keywords, run: go(c.href) })),
      {
        id: "theme",
        group: "Preferences",
        label: resolvedTheme === "dark" ? "Switch to light theme" : "Switch to dark theme",
        icon: resolvedTheme === "dark" ? Sun : Moon,
        keywords: "appearance dark light",
        run: () => {
          setTheme(resolvedTheme === "dark" ? "light" : "dark")
          onOpenChange(false)
        },
      },
      {
        id: "signout",
        group: "Preferences",
        label: "Sign out",
        icon: LogOut,
        keywords: "logout exit",
        run: async () => {
          await authClient.signOut()
          window.location.replace("/login")
        },
      },
    ]
  }, [role, router, resolvedTheme, setTheme, onOpenChange])

  const q = query.trim().toLowerCase()
  const filtered = q ? entries.filter((e) => `${e.label} ${e.keywords ?? ""} ${e.group}`.toLowerCase().includes(q)) : entries
  const groups = [...new Set(filtered.map((e) => e.group))]
  const safeActive = Math.min(active, Math.max(0, filtered.length - 1))

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setActive((a) => Math.min(filtered.length - 1, a + 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActive((a) => Math.max(0, a - 1))
    } else if (e.key === "Enter") {
      e.preventDefault()
      filtered[safeActive]?.run()
    }
  }

  React.useEffect(() => {
    listRef.current?.querySelector(`[data-index="${safeActive}"]`)?.scrollIntoView({ block: "nearest" })
  }, [safeActive])

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o)
        if (!o) {
          setQuery("")
          setActive(0)
        }
      }}
    >
      <DialogContent className="top-[18%] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-lg" showCloseButton={false}>
        <DialogTitle className="sr-only">Command menu</DialogTitle>
        <div className="flex items-center gap-2 border-b px-3">
          <Search className="size-4 text-muted-foreground" aria-hidden />
          <input
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setActive(0)
            }}
            onKeyDown={onKey}
            placeholder="Search pages and actions"
            role="combobox"
            aria-expanded="true"
            aria-controls="cmd-list"
            aria-activedescendant={filtered[safeActive] ? `cmd-${safeActive}` : undefined}
            className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <kbd className="rounded border px-1.5 py-0.5 font-mono text-[0.65rem] text-muted-foreground">Esc</kbd>
        </div>
        <ul id="cmd-list" ref={listRef} role="listbox" aria-label="Commands" className="scrollbar-thin max-h-80 overflow-y-auto p-1.5">
          {groups.map((g) => (
            <li key={g} role="presentation">
              <p className="px-2.5 pt-2.5 pb-1 text-[0.7rem] font-medium text-muted-foreground">{g}</p>
              <ul role="presentation">
                {filtered
                  .map((e, i) => ({ e, i }))
                  .filter(({ e }) => e.group === g)
                  .map(({ e, i }) => (
                    <li
                      key={e.id}
                      id={`cmd-${i}`}
                      role="option"
                      aria-selected={i === safeActive}
                      data-index={i}
                      onMouseMove={() => setActive(i)}
                      onClick={e.run}
                      className={cn(
                        "flex cursor-pointer items-center gap-3 rounded-md px-2.5 py-2 text-sm",
                        i === safeActive ? "bg-brand-soft text-foreground" : "text-foreground/90"
                      )}
                    >
                      <e.icon className={cn("size-4", i === safeActive ? "text-brand-text" : "text-muted-foreground")} />
                      <span className="flex-1">{e.label}</span>
                      {i === safeActive && <CornerDownLeft className="size-3.5 text-muted-foreground" aria-hidden />}
                    </li>
                  ))}
              </ul>
            </li>
          ))}
          {!filtered.length && <li className="px-3 py-8 text-center text-sm text-muted-foreground">Nothing matches &quot;{query}&quot;.</li>}
        </ul>
      </DialogContent>
    </Dialog>
  )
}
