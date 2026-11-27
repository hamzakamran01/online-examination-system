"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

export function ExamTabs({ examId }: { examId: string }) {
  const pathname = usePathname()
  const base = `/examiner/exams/${examId}`
  const tabs = [
    { href: base, label: "Settings" },
    { href: `${base}/questions`, label: "Questions" },
    { href: `${base}/candidates`, label: "Candidates" },
    { href: `${base}/review`, label: "Review and publish" },
    { href: `${base}/monitor`, label: "Live monitor" },
    { href: `${base}/results`, label: "Grading and results" },
    { href: `${base}/analytics`, label: "Analytics" },
  ]
  return (
    <nav aria-label="Exam sections" className="-mx-4 overflow-x-auto border-b px-4 sm:mx-0 sm:px-0">
      <ul className="flex min-w-max gap-1">
        {tabs.map((t) => {
          const active = t.href === base ? pathname === base : pathname.startsWith(t.href)
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative inline-flex h-10 items-center px-3 text-sm font-medium transition-colors",
                  active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {t.label}
                {active && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-primary" aria-hidden />}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
