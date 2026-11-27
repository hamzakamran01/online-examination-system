"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { BarChart3, ClipboardCheck, Gavel, ListOrdered, PenLine, Radio, Settings2, Users } from "lucide-react"
import { cn } from "@/lib/utils"

export function ExamTabs({ examId, live = false }: { examId: string; live?: boolean }) {
  const pathname = usePathname()
  const base = `/examiner/exams/${examId}`
  const tabs = [
    { href: base, label: "Settings", icon: Settings2 },
    { href: `${base}/questions`, label: "Questions", icon: ListOrdered },
    { href: `${base}/candidates`, label: "Candidates", icon: Users },
    { href: `${base}/review`, label: "Review and publish", icon: ClipboardCheck },
    { href: `${base}/monitor`, label: "Live monitor", icon: Radio },
    { href: `${base}/results`, label: "Grading and results", icon: PenLine },
    { href: `${base}/disputes`, label: "Disputes", icon: Gavel },
    { href: `${base}/analytics`, label: "Analytics", icon: BarChart3 },
  ]
  return (
    <nav aria-label="Exam sections" className="scrollbar-none -mx-4 overflow-x-auto border-b px-4 sm:mx-0 sm:px-0">
      <ul className="flex min-w-max gap-1">
        {tabs.map((t) => {
          const active = t.href === base ? pathname === base : pathname.startsWith(t.href)
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group relative inline-flex h-11 items-center gap-2 px-3 text-sm font-medium transition-colors",
                  active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <t.icon className={cn("size-4", active ? "text-brand-text" : "text-subtle-foreground group-hover:text-muted-foreground")} aria-hidden />
                {t.label}
                {live && t.label === "Live monitor" && (
                  <>
                    <span className="size-1.5 animate-live rounded-full bg-success text-success" aria-hidden />
                    <span className="sr-only">(exam is live)</span>
                  </>
                )}
                <span
                  className={cn(
                    "absolute inset-x-2 -bottom-px h-0.5 rounded-full transition-colors",
                    active ? "bg-primary" : "bg-transparent group-hover:bg-border-strong"
                  )}
                  aria-hidden
                />
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
