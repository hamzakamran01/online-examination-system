import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { Clock3, ShieldCheck, WifiOff } from "lucide-react"
import { getCurrentUser, homeFor } from "@/server/auth/guards"
import { LoginForm } from "./login-form"
import { Logo } from "@/components/shell/logo"

export const metadata: Metadata = { title: "Sign in" }

const points = [
  { icon: Clock3, title: "Server-timed attempts", body: "Time is kept by the server, never by the device clock." },
  { icon: WifiOff, title: "Built for weak networks", body: "Answers are journaled locally and synced the moment you reconnect." },
  { icon: ShieldCheck, title: "Verifiable results", body: "Every issued report carries a code anyone can verify." },
]

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const user = await getCurrentUser()
  if (user) redirect(homeFor(user.role))
  const { next } = await searchParams
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : undefined

  return (
    <main id="main" className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <section className="surface-ink relative hidden flex-col justify-between overflow-hidden p-10 lg:flex">
        <div className="bg-grid mask-radial pointer-events-none absolute inset-0 opacity-40" aria-hidden />
        <Logo className="relative" />
        <div className="relative max-w-md space-y-8">
          <h1 className="text-4xl leading-tight font-semibold tracking-tight text-balance">
            Fair examinations, even when the network is not.
          </h1>
          <ul className="space-y-5">
            {points.map(({ icon: Icon, title, body }) => (
              <li key={title} className="flex gap-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-white/10">
                  <Icon className="size-5" aria-hidden />
                </span>
                <div>
                  <p className="font-medium">{title}</p>
                  <p className="text-sm text-muted-foreground">{body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-muted-foreground">Technoverse 5.0 Web-e-Thon</p>
      </section>

      <section className="flex items-center justify-center bg-background px-4 py-12 sm:px-8">
        <div className="w-full max-w-sm space-y-8">
          <Logo className="lg:hidden" />
          <div className="space-y-1.5">
            <h2 className="text-2xl font-semibold tracking-tight">Sign in</h2>
            <p className="text-sm text-muted-foreground">Use the account your institution created for you.</p>
          </div>
          <LoginForm next={safeNext} />
        </div>
      </section>
    </main>
  )
}
