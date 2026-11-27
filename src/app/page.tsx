import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { LandingPage } from "@/features/marketing/landing-page"
import { getCurrentUser, homeFor } from "@/server/auth/guards"

export const metadata: Metadata = {
  title: "Examinations built for real-world conditions",
  description:
    "Create, deliver, monitor and review online examinations with server-authoritative timing, outage-aware answer saving and accountable results.",
}

export default async function Home() {
  const user = await getCurrentUser()
  if (user) redirect(homeFor(user.role))
  return <LandingPage />
}
