import Link from "next/link"
import { UserPlus } from "lucide-react"
import { requirePageRole } from "@/server/auth/guards"
import { getPlatformOverview } from "@/server/services/platform"
import { AppShell } from "@/components/shell/app-shell"
import { AdminWidget } from "@/components/shell/sidebar-widgets"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export default async function Layout({ children }: { children: React.ReactNode }) {
  const user = await requirePageRole("admin")
  // Sidebar context is best effort: a failed query must never block the page.
  const o = await getPlatformOverview(user).catch(() => null)
  const s = (o?.stats ?? {}) as Record<string, number>
  const accounts = (s["Active candidates"] ?? 0) + (s["Active examiners"] ?? 0) + (s["Active administrators"] ?? 0)

  return (
    <AppShell
      role="admin"
      user={{ name: user.name, email: user.email }}
      badges={{
        "/admin/overview": o?.attention.length ? { n: o.attention.length, tone: "time", label: "items need attention" } : { n: 0 },
        "/admin": { n: accounts, label: "active accounts" },
      }}
      action={
        <Link href="/admin?new=1" className={cn(buttonVariants(), "h-9 w-full")}>
          <UserPlus />
          Create account
        </Link>
      }
      widget={o ? <AdminWidget writing={s["Candidates writing"] ?? 0} today={s["Submitted today"] ?? 0} attention={o.attention.length} /> : undefined}
    >
      {children}
    </AppShell>
  )
}
