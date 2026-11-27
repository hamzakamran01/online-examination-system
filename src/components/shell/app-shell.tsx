"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTheme } from "next-themes"
import { ChevronRight, ChevronsUpDown, LogOut, Menu, Moon, Search, Sun } from "lucide-react"
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
import { CommandPalette } from "./command-palette"
import { NAV, ROLE_LABEL, crumbs, type NavItem, type Role } from "./nav"

type ShellUser = { name: string; email: string }

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

function SidebarNav({ role, onNavigate }: { role: Role; onNavigate?: () => void }) {
  const pathname = usePathname()
  return (
    <nav aria-label="Main" className="flex flex-col gap-6 px-3">
      {NAV[role].map((group) => (
        <div key={group.label}>
          <p className="px-2.5 pb-1.5 text-xs font-medium text-subtle-foreground">{group.label}</p>
          <ul className="flex flex-col gap-0.5">
            {group.items.map((item) => {
              const active = isActive(pathname, item)
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex h-9 items-center gap-2.5 rounded-md px-2.5 text-sm transition-colors duration-150",
                      active ? "bg-brand-soft font-medium text-brand-text" : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
                    )}
                  >
                    <item.icon className="size-4 shrink-0" aria-hidden />
                    {item.label}
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
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
            className="flex w-full items-center gap-2.5 rounded-md p-2 text-left transition-colors hover:bg-sidebar-accent"
            aria-label={`Account menu for ${user.name}`}
          />
        }
      >
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-soft text-xs font-semibold text-brand-text" aria-hidden>
          {initials(user.name)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{user.name}</span>
          <span className="block truncate text-xs text-muted-foreground">{ROLE_LABEL[role]}</span>
        </span>
        <ChevronsUpDown className="size-4 text-muted-foreground" aria-hidden />
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

export function AppShell({ role, user, children }: { role: Role; user: ShellUser; children: React.ReactNode }) {
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
    <div className="flex h-full flex-col">
      <div className="flex h-14 items-center px-5">
        <Link href="/" onClick={onNavigate} className="rounded-md">
          <Logo />
        </Link>
      </div>
      <div className="px-3 pt-2 pb-5">
        <button
          type="button"
          onClick={() => {
            onNavigate?.()
            setCmdOpen(true)
          }}
          className="flex h-9 w-full items-center gap-2 rounded-md border bg-surface px-2.5 text-sm text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground"
        >
          <Search className="size-4" aria-hidden />
          <span className="flex-1 text-left">Search</span>
          <kbd className="rounded border px-1 font-mono text-[0.65rem]">Ctrl K</kbd>
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        <SidebarNav role={role} onNavigate={onNavigate} />
      </div>
      <div className="border-t border-sidebar-border p-2">
        <UserMenu user={user} role={role} />
      </div>
    </div>
  )

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-dvh border-r border-sidebar-border bg-sidebar lg:block">{sidebar()}</aside>

      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="left" className="w-72 bg-sidebar p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          {sidebar(() => setMenuOpen(false))}
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/85 px-4 backdrop-blur-sm sm:px-6 lg:px-8">
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
        <main id="main" className="min-w-0 flex-1">
          <div className="mx-auto w-full max-w-[1200px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</div>
        </main>
      </div>

      <CommandPalette role={role} open={cmdOpen} onOpenChange={setCmdOpen} />
    </div>
  )
}
