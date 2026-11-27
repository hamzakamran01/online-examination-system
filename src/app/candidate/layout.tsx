import { requirePageRole } from "@/server/auth/guards"
import { AppShell } from "@/components/shell/app-shell"

export default async function Layout({ children }: { children: React.ReactNode }) {
  const user = await requirePageRole("candidate")
  return (
    <AppShell role="candidate" user={{ name: user.name, email: user.email }}>
      {children}
    </AppShell>
  )
}
