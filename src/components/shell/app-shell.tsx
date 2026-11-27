"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTheme } from "next-themes"
import { BookOpenCheck, ClipboardList, FileClock, FileUp, LayoutDashboard, LogOut, Menu, Moon, Sun, Users } from "lucide-react"
import { cn } from "@/lib/utils"
import { authClient } from "@/lib/auth-client"
import { Logo } from "./logo"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"

type Role = "admin" | "examiner" | "candidate"
type NavItem = { href: string; label: string; icon: React.ComponentType<{ className?: string }>; exact?: boolean }

const NAV: Record<Role, NavItem[]> = {
  admin: [
    { href: "/admin/overview", label: "Overview", icon: LayoutDashboard },
    { href: "/admin", label: "Users", icon: Users, exact: true },
    { href: "/admin/audit", label: "Audit log", icon: FileClock },
  ],
  examiner: [
    { href: "/examiner", label: "Exams", icon: LayoutDashboard, exact: true },
    { href: "/examiner/bank", label: "Question bank", icon: BookOpenCheck },
    { href: "/examiner/imports", label: "Bulk import", icon: FileUp },
  ],
  candidate: [{ href: "/candidate", label: "My exams", icon: ClipboardList, exact: true }],
}

const ROLE_LABEL: Record<Role, string> = { admin: "Administrator", examiner: "Examiner", candidate: "Candidate" }

function isActive(pathname: string, item: NavItem) {
  if (item.exact) return pathname === item.href || (item.href === "/examiner" && pathname.startsWith("/examiner/exams"))
  return pathname.startsWith(item.href)
}

function SidebarBody({ role, user, onNavigate }: { role: Role; user: { name: string; email: string }; onNavigate?: () => void }) {
  const pathname = usePathname()
  const { resolvedTheme, setTheme } = useTheme()
  const [signingOut, setSigningOut] = React.useState(false)
  const initials = user.name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-col gap-4 px-5 pt-6 pb-5">
        <Link href="/" onClick={onNavigate} className="rounded-md">
          <Logo inverse />
        </Link>
        <p className="text-[0.65rem] font-medium tracking-[0.18em] text-muted-foreground uppercase">{ROLE_LABEL[role]} desk</p>
      </div>
      <nav aria-label="Main" className="flex-1 px-3">
        <ul className="flex flex-col gap-0.5">
          {NAV[role].map((item) => {
            const active = isActive(pathname, item)
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                    active
                      ? "bg-sidebar-accent text-foreground shadow-[inset_3px_0_0_0_var(--seal)]"
                      : "text-muted-foreground hover:bg-sidebar-accent/70 hover:text-foreground"
                  )}
                >
                  <item.icon className={cn("size-4", active && "text-seal")} />
                  {item.label}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
      <div className="flex flex-col gap-3 border-t border-sidebar-border p-3">
        <div className="flex items-center gap-3 rounded-md bg-white/5 px-2 py-2">
          <span
            className="grid size-9 shrink-0 place-items-center rounded-md bg-seal/20 font-heading text-sm font-semibold text-seal"
            aria-hidden
          >
            {initials}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{user.name}</p>
            <p className="truncate text-xs text-muted-foreground">{user.email}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 border-white/15 bg-transparent text-foreground hover:bg-white/10"
            onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
            aria-label="Toggle dark mode"
          >
            <Sun className="hidden dark:block" />
            <Moon className="dark:hidden" />
            Theme
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1 border-white/15 bg-transparent text-foreground hover:bg-white/10"
            disabled={signingOut}
            onClick={async () => {
              setSigningOut(true)
              await authClient.signOut()
              window.location.replace("/login")
            }}
          >
            <LogOut />
            Sign out
          </Button>
        </div>
      </div>
    </div>
  )
}

export function AppShell({ role, user, children }: { role: Role; user: { name: string; email: string }; children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false)
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[272px_1fr]">
      <aside className="surface-ink sticky top-0 hidden h-dvh border-r border-sidebar-border shadow-[inset_0_3px_0_0_var(--seal)] lg:block">
        <SidebarBody role={role} user={user} />
      </aside>

      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-background/90 px-4 backdrop-blur lg:hidden">
        <Logo compact />
        <Button variant="ghost" size="icon" aria-label="Open menu" onClick={() => setOpen(true)}>
          <Menu />
        </Button>
      </header>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="surface-ink w-72 p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SidebarBody role={role} user={user} onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>

      <main id="main" className="min-w-0">
        <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-10 lg:py-10">{children}</div>
      </main>
    </div>
  )
}
