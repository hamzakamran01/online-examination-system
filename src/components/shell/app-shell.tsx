"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTheme } from "next-themes"
import { ChevronRight, ChevronsUpDown, LogOut, Menu, Moon, Search, ShieldCheck, Sun } from "lucide-react"
import { cn } from "@/lib/utils"
import { authClient } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Logo } from "./logo"
import { ServerClock } from "./server-clock"
import { SheetBackdrop } from "./decor"
import { SystemStatus } from "./system-status"
import { CommandPalette } from "./command-palette"
import { NAV, ROLE_LABEL, crumbs, type NavItem, type Role } from "./nav"

const ROLE_SHORT: Record<Role, string> = { admin: "Admin", examiner: "Examiner", candidate: "Candidate" }

type ShellUser = { name: string; email: string }
export type NavBadge = { n: number; tone?: "live" | "time" | "neutral"; label?: string }

const BADGE_TONE = {
  live: "bg-sidebar-accent text-sidebar-foreground",
  time: "bg-sidebar-accent text-sidebar-foreground",
  neutral: "bg-sidebar-accent text-sidebar-foreground",
} as const

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter((p) => /^[A-Za-z]/.test(p))
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()

function isActive(path: string, item: NavItem) {
  return item.match ? item.match(path) : path === item.href || path.startsWith(item.href + "/")
}

function SidebarNav({ role, badges, onNavigate }: { role: Role; badges?: Record<string, NavBadge>; onNavigate?: () => void }) {
  const pathname = usePathname()
  return (
    <nav aria-label="Main" className="flex flex-col gap-6 px-3">
      {NAV[role].map((group) => (
        <div key={group.label}>
          <p className="eyebrow px-2.5 pb-2 text-sidebar-foreground/65">{group.label}</p>
          <ul className="flex flex-col gap-0.5">
            {group.items.map((item) => {
              const active = isActive(pathname, item)
              const badge = badges?.[item.href]
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "relative flex h-9 items-center gap-2.5 rounded-md px-2.5 text-sm transition-colors duration-150",
                      active
                        ? "bg-sidebar-accent font-medium text-sidebar-foreground ring-1 ring-sidebar-border before:absolute before:inset-y-2 before:-left-3 before:w-[3px] before:rounded-r-full before:bg-sidebar-primary"
                        : "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                    )}
                  >
                    <item.icon className={cn("size-4 shrink-0", active && "text-sidebar-primary")} aria-hidden />
                    <span className="flex-1 truncate">{item.label}</span>
                    {badge && badge.n > 0 && (
                      <span className={cn("inline-flex h-5 min-w-5 items-center justify-center gap-1 rounded-full px-1.5 text-[0.68rem] font-semibold tabular-nums", BADGE_TONE[badge.tone ?? "neutral"])}>
                        {badge.tone === "live" && <span className="size-1.5 animate-live rounded-full bg-current" aria-hidden />}
                        {badge.n}
                        {badge.label && <span className="sr-only"> {badge.label}</span>}
                      </span>
                    )}
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
      <div>
        <p className="eyebrow px-2.5 pb-2 text-sidebar-foreground/65">Resources</p>
        <Link
          href="/verify"
          onClick={onNavigate}
          className="flex h-9 items-center gap-2.5 rounded-md px-2.5 text-sm text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
        >
          <ShieldCheck className="size-4 shrink-0" aria-hidden />
          Verify a report
        </Link>
      </div>
    </nav>
  )
}

function UserMenu({ user, role }: { user: ShellUser; role: Role }) {
  const { resolvedTheme, setTheme } = useTheme()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            className="flex w-full items-center gap-2.5 rounded-lg p-2 text-left transition-colors hover:bg-sidebar-accent"
            aria-label={`Account menu for ${user.name}`}
          />
        }
      >
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-sidebar-primary text-xs font-semibold text-primary-foreground shadow-edge ring-2 ring-sidebar" aria-hidden>
          {initials(user.name)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{user.name}</span>
          <span className="block truncate text-xs text-sidebar-foreground/70">{ROLE_LABEL[role]}</span>
        </span>
        <ChevronsUpDown className="size-4 text-sidebar-foreground/70" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="w-60">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="font-normal">
            <span className="block text-sm font-medium text-foreground">{user.name}</span>
            <span className="block truncate text-xs text-muted-foreground">{user.email}</span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}>
          {resolvedTheme === "dark" ? <Sun /> : <Moon />}
          {resolvedTheme === "dark" ? "Light theme" : "Dark theme"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onClick={async () => {
            await authClient.signOut()
            // Full navigation drops every cached server component of the old session.
            window.location.replace("/login")
          }}
        >
          <LogOut />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function Breadcrumbs() {
  const pathname = usePathname()
  const items = crumbs(pathname)
  if (items.length < 2) return <span className="truncate text-sm font-medium">{items[0]?.label}</span>
  return (
    <nav aria-label="Breadcrumb" className="min-w-0">
      <ol className="flex items-center gap-1.5 text-sm">
        {items.map((c, i) => {
          const last = i === items.length - 1
          return (
            <li key={c.href} className={cn("flex min-w-0 items-center gap-1.5", !last && "hidden sm:flex")}>
              {last ? (
                <span aria-current="page" className="truncate font-medium">
                  {c.label}
                </span>
              ) : (
                <>
                  <Link href={c.href} className="truncate text-muted-foreground hover:text-foreground">
                    {c.label}
                  </Link>
                  <ChevronRight className="size-3.5 shrink-0 text-subtle-foreground" aria-hidden />
                </>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

export function AppShell({
  role,
  user,
  children,
  action,
  widget,
  badges,
}: {
  role: Role
  user: ShellUser
  children: React.ReactNode
  /** Primary quick action for this role, rendered on the server. */
  action?: React.ReactNode
  /** Live context card for this role, rendered on the server. */
  widget?: React.ReactNode
  badges?: Record<string, NavBadge>
}) {
  const [menuOpen, setMenuOpen] = React.useState(false)
  const [cmdOpen, setCmdOpen] = React.useState(false)

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setCmdOpen((o) => !o)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  const sidebar = (onNavigate?: () => void) => (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex h-14 items-center justify-between gap-2 px-5">
        <Link href="/" onClick={onNavigate} className="rounded-md">
          <Logo />
        </Link>
        <span className="eyebrow rounded border border-sidebar-border bg-sidebar-accent px-1.5 py-0.5 text-[0.6rem] text-sidebar-foreground/75">{ROLE_SHORT[role]}</span>
      </div>
      <div className="space-y-2 px-3 pt-2 pb-5">
        {action && <div onClickCapture={onNavigate}>{action}</div>}
        <button
          type="button"
          onClick={() => {
            onNavigate?.()
            setCmdOpen(true)
          }}
          className="flex h-9 w-full items-center gap-2 rounded-lg border border-sidebar-border bg-sidebar-accent px-2.5 text-sm text-sidebar-foreground/80 transition-colors hover:border-sidebar-ring hover:text-sidebar-foreground"
        >
          <Search className="size-4" aria-hidden />
          <span className="flex-1 text-left">Search</span>
          <kbd className="rounded border border-sidebar-border bg-sidebar px-1 font-mono text-[0.65rem] text-sidebar-foreground/70">Ctrl K</kbd>
        </button>
      </div>
      <div className="scrollbar-thin flex flex-1 flex-col gap-5 overflow-y-auto pb-4">
        <SidebarNav role={role} badges={badges} onNavigate={onNavigate} />
        {widget && <div className="mt-auto px-3">{widget}</div>}
      </div>
      <div className="space-y-1 border-t border-sidebar-border p-2">
        <SystemStatus />
        <UserMenu user={user} role={role} />
      </div>
    </div>
  )

  return (
    // Inverted-L chrome (sidebar + top bar) frames an inset work sheet. On large
    // screens the sheet scrolls by itself so the frame and its rounded corner stay put.
    <div className="min-h-dvh bg-chrome lg:grid lg:h-dvh lg:grid-cols-[252px_minmax(0,1fr)] lg:overflow-hidden">
      <aside className="hidden h-dvh bg-sidebar lg:block">{sidebar()}</aside>

      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="left" className="w-72 bg-sidebar p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          {sidebar(() => setMenuOpen(false))}
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-col lg:h-dvh">
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-chrome-border bg-chrome/90 px-4 backdrop-blur-md sm:px-6 lg:static lg:border-b-0 lg:px-4">
          <Button variant="ghost" size="icon" className="-ml-1 lg:hidden" aria-label="Open navigation" onClick={() => setMenuOpen(true)}>
            <Menu />
          </Button>
          <div className="min-w-0 flex-1">
            <Breadcrumbs />
          </div>
          <Button variant="ghost" size="icon" className="sm:hidden" aria-label="Search" onClick={() => setCmdOpen(true)}>
            <Search />
          </Button>
          <ServerClock />
        </header>
        <main
          id="main"
          className="scrollbar-thin relative isolate min-w-0 flex-1 bg-canvas lg:mr-2 lg:mb-2 lg:overflow-y-auto lg:rounded-xl lg:border lg:border-chrome-border lg:shadow-panel"
        >
          <SheetBackdrop className="-z-10" />
          <div className="relative mx-auto w-full max-w-[1200px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</div>
        </main>
      </div>

      <CommandPalette role={role} open={cmdOpen} onOpenChange={setCmdOpen} />
    </div>
  )
}
