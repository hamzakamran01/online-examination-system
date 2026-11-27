import type { Metadata } from "next"
import { requirePageRole } from "@/server/auth/guards"
import { listUsers } from "@/server/services/users"
import { PageHeader, Stat } from "@/components/shell/page-header"
import { UsersManager } from "@/features/users/users-manager"

export const metadata: Metadata = { title: "Users" }

export default async function AdminUsersPage() {
  const actor = await requirePageRole("admin")
  const users = await listUsers(actor)
  const count = (role: string) => users.filter((u) => u.role === role && u.active).length
  const inactive = users.filter((u) => !u.active).length

  return (
    <>
      <PageHeader
        title="Users and roles"
        description="Create accounts, assign roles and deactivate access. Every change is enforced on the server and recorded in the audit log."
      />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Administrators" value={count("admin")} />
        <Stat label="Examiners" value={count("examiner")} />
        <Stat label="Candidates" value={count("candidate")} />
        <Stat label="Deactivated" value={inactive} tone={inactive ? "warning" : undefined} />
      </div>
      <UsersManager
        currentUserId={actor.id}
        users={users.map((u) => ({ ...u, createdAt: u.createdAt.toISOString() }))}
      />
    </>
  )
}
