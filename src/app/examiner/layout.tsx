import Link from "next/link"
import { FilePlus2 } from "lucide-react"
import { requirePageRole } from "@/server/auth/guards"
import { listManagedExams } from "@/server/services/exams"
import { AppShell } from "@/components/shell/app-shell"
import { ExaminerWidget } from "@/components/shell/sidebar-widgets"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export default async function Layout({ children }: { children: React.ReactNode }) {
  const user = await requirePageRole("examiner")
  // Sidebar context is best effort: a failed query must never block the page.
  const exams = await listManagedExams(user).catch(() => [])
  const live = exams.filter((e) => e.stage === "live")
  const toGrade = exams.reduce((n, e) => n + e.toGradeCount, 0)
  const next = exams.filter((e) => e.stage === "scheduled").sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())[0]

  return (
    <AppShell
      role="examiner"
      user={{ name: user.name, email: user.email }}
      badges={{
        "/examiner": toGrade ? { n: toGrade, tone: "time", label: "attempts to grade" } : { n: 0 },
        "/examiner/exams": live.length ? { n: live.length, tone: "live", label: "live exams" } : { n: exams.length, label: "exams" },
      }}
      action={
        <Link href="/examiner/exams/new" className={cn(buttonVariants(), "h-9 w-full")}>
          <FilePlus2 />
          New exam
        </Link>
      }
      widget={<ExaminerWidget next={next} />}
    >
      {children}
    </AppShell>
  )
}
