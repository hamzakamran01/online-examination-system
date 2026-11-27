import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { Clock3, ShieldCheck, WifiOff } from "lucide-react"
import { getCurrentUser, homeFor } from "@/server/auth/guards"
import { LoginForm } from "./login-form"
import { Logo } from "@/components/shell/logo"

export const metadata: Metadata = { title: "Sign in" }

const points = [
  { n: "01", icon: Clock3, title: "Server-timed attempts", body: "Time is kept by the server, never by the device clock." },
  { n: "02", icon: WifiOff, title: "Built for weak networks", body: "Answers are journaled locally and synced the moment you reconnect." },
  { n: "03", icon: ShieldCheck, title: "Verifiable results", body: "Every issued report carries a code anyone can verify." },
]

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const user = await getCurrentUser()
  if (user) redirect(homeFor(user.role))
  const { next } = await searchParams
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : undefined

  return (
    <main id="main" className="grid min-h-dvh lg:grid-cols-[1.08fr_1fr]">
      <section className="surface-ink relative hidden flex-col justify-between overflow-hidden p-10 lg:flex xl:p-14">
        <div className="bg-grid mask-radial pointer-events-none absolute inset-0 opacity-30" aria-hidden />
        <div className="relative flex items-start justify-between gap-4">
          <Logo inverse />
          <p className="font-mono text-[0.65rem] tracking-[0.18em] text-muted-foreground uppercase">EV-REG / 2026</p>
        </div>
        <div className="relative max-w-lg">
          <p className="kicker mb-4 text-seal-text">Failure-resilient examinations</p>
          <h1 className="font-heading text-4xl leading-[1.15] font-medium tracking-tight text-balance xl:text-5xl">
            Fair papers, even when the network is not.
          </h1>
          <ul className="mt-10 flex flex-col gap-6">
            {points.map(({ n, icon: Icon, title, body }) => (
              <li key={title} className="flex gap-4">
                <span className="grid size-11 shrink-0 place-items-center rounded-md border border-white/10 bg-white/5">
                  <Icon className="size-5" aria-hidden />
                </span>
                <div>
                  <p className="text-[0.65rem] tracking-[0.16em] text-muted-foreground uppercase">{n}</p>
                  <p className="font-heading text-lg font-medium">{title}</p>
                  <p className="text-sm text-muted-foreground">{body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-muted-foreground">Technoverse 5.0 Web-e-Thon · COMSATS University Lahore</p>
      </section>

      <section className="flex items-center justify-center bg-canvas px-4 py-12 sm:px-8">
        <div className="rule-top w-full max-w-md rounded-lg border bg-paper p-6 shadow-panel sm:p-8">
          <Logo className="mb-8 lg:hidden" />
          <div className="mb-8">
            <p className="kicker mb-2">Credential desk</p>
            <h2 className="font-heading text-3xl font-medium tracking-tight">Sign in</h2>
            <p className="mt-1.5 text-sm text-muted-foreground">Use the account your institution created for you.</p>
          </div>
          <LoginForm next={safeNext} />
        </div>
      </section>
    </main>
  )
}
