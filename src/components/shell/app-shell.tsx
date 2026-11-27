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

  return (
    <div className="flex h-full flex-col">
      <div className="px-5 pt-5 pb-6">
        <Link href="/" onClick={onNavigate} className="rounded-md">
          <Logo />
        </Link>
      </div>
      <nav aria-label="Main" className="flex-1 px-3">
        <p className="px-3 pb-2 text-[0.7rem] font-medium tracking-wider text-muted-foreground uppercase">{ROLE_LABEL[role]}</p>
        <ul className="space-y-0.5">
          {NAV[role].map((item) => {
            const active = isActive(pathname, item)
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    active ? "bg-sidebar-accent text-foreground" : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground"
                  )}
                >
                  <item.icon className={cn("size-4", active && "text-primary")} />
                  {item.label}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
      <div className="space-y-3 border-t border-sidebar-border p-3">
        <div className="flex items-center gap-3 px-2">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/15 text-sm font-semibold text-primary" aria-hidden>
            {user.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
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
            className="flex-1"
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
            className="flex-1"
            disabled={signingOut}
            onClick={async () => {
              setSigningOut(true)
              await authClient.signOut()
              // Full navigation clears every cached server component of the old session.
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
    <div className="min-h-dvh lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="sticky top-0 hidden h-dvh border-r border-sidebar-border bg-sidebar lg:block">
        <SidebarBody role={role} user={user} />
      </aside>

      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-background/90 px-4 backdrop-blur lg:hidden">
        <Logo />
        <Button variant="ghost" size="icon" aria-label="Open menu" onClick={() => setOpen(true)}>
          <Menu />
        </Button>
      </header>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-72 bg-sidebar p-0">
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
