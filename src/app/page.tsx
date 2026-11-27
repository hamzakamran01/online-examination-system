import { redirect } from "next/navigation"
import { getCurrentUser, homeFor } from "@/server/auth/guards"

export default async function Home() {
  const user = await getCurrentUser()
  redirect(user ? homeFor(user.role) : "/login")
}
