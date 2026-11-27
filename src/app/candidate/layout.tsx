import { requirePageRole } from "@/server/auth/guards"
import { listCandidateExams } from "@/server/services/attempts"
import { AppShell } from "@/components/shell/app-shell"
import { CandidateWidget } from "@/components/shell/sidebar-widgets"

export default async function Layout({ children }: { children: React.ReactNode }) {
  const user = await requirePageRole("candidate")
  // Sidebar context is best effort: a failed query must never block the page.
  const exams = await listCandidateExams(user).catch(() => [])
  const resume = exams.find((e) => e.access.kind === "resume")
  const open = exams.find((e) => e.access.kind === "open")
  const upcoming = exams.find((e) => e.access.kind === "upcoming")
  const pick = resume ?? open ?? upcoming
  const a = pick?.access
  const openCount = exams.filter((e) => e.access.kind === "open" || e.access.kind === "resume").length
  const published = exams.filter((e) => e.access.kind === "submitted" && e.resultsPublishedAt).length

  return (
    <AppShell
      role="candidate"
      user={{ name: user.name, email: user.email }}
      badges={{
        "/candidate": openCount ? { n: openCount, tone: "live", label: "exams open now" } : { n: exams.length, label: "assigned exams" },
        "/candidate/results": { n: published, label: "published results" },
      }}
      widget={
        pick && a && (a.kind === "resume" || a.kind === "open" || a.kind === "upcoming") ? (
          <CandidateWidget
            focus={{
              id: pick.id,
              title: pick.title,
              kind: a.kind,
              attemptId: a.kind === "resume" ? a.attemptId : undefined,
              opensAt: a.kind === "upcoming" ? a.opensAt : undefined,
            }}
          />
        ) : undefined
      }
    >
      {children}
    </AppShell>
  )
}
