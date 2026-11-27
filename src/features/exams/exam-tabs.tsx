"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

export function ExamTabs({ examId }: { examId: string }) {
  const pathname = usePathname()
  const base = `/examiner/exams/${examId}`
  const tabs = [
    { href: base, n: "01", label: "Settings" },
    { href: `${base}/questions`, n: "02", label: "Paper" },
    { href: `${base}/candidates`, n: "03", label: "Candidates" },
    { href: `${base}/review`, n: "04", label: "Review" },
    { href: `${base}/results`, n: "05", label: "Grading" },
    { href: `${base}/analytics`, n: "06", label: "Analytics" },
  ]
  return (
    <nav aria-label="Exam sections" className="-mx-4 overflow-x-auto border-b px-4 sm:mx-0 sm:px-0">
      <ul className="flex min-w-max gap-0">
        {tabs.map((t) => {
          const active = t.href === base ? pathname === base : pathname.startsWith(t.href)
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative inline-flex h-12 items-center gap-2 px-3.5 text-sm font-medium transition-colors",
                  active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <span className={cn("font-mono text-[0.65rem] tracking-wider", active ? "text-seal-text" : "text-muted-foreground/80")}>
                  {t.n}
                </span>
                {t.label}
                {active && <span className="absolute inset-x-3 -bottom-px h-0.5 bg-primary" aria-hidden />}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
