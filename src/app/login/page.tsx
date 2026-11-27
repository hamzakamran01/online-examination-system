import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { CheckCircle2, CloudOff, ShieldCheck, Timer } from "lucide-react"
import { getCurrentUser, homeFor } from "@/server/auth/guards"
import { LoginForm } from "./login-form"
import { Logo, LogoMark } from "@/components/shell/logo"

export const metadata: Metadata = { title: "Sign in" }

const guarantees = [
  { icon: Timer, title: "The server keeps time", body: "Deadlines are fixed on the server when you start. Changing a device clock changes nothing." },
  { icon: CloudOff, title: "Answers survive outages", body: "Every answer is kept on your device first, then synced. A dropped connection or a refresh loses nothing." },
  { icon: ShieldCheck, title: "Results you can verify", body: "Each issued report carries a code and QR that anyone can check, without seeing private data." },
]

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const user = await getCurrentUser()
  if (user) redirect(homeFor(user.role))
  const { next } = await searchParams
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : undefined

  return (
    <main id="main" className="grid min-h-dvh lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <section className="surface-ink bg-ruled relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-16" aria-label="About ExamVault">
        <div className="flex items-center gap-2.5">
          <LogoMark className="bg-white text-[oklch(0.3_0.06_192)]" />
          <span className="font-display text-lg font-semibold">ExamVault</span>
        </div>

        <div className="max-w-xl">
          <h1 className="font-display text-[2.6rem] leading-[1.08] font-semibold xl:text-5xl">
            Online exams that stay fair when the network does not.
          </h1>
          <ul className="mt-10 flex flex-col gap-6">
            {guarantees.map(({ icon: Icon, title, body }) => (
              <li key={title} className="flex gap-4">
                <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg border border-white/15 bg-white/5">
                  <Icon className="size-[1.1rem]" aria-hidden />
                </span>
                <div>
                  <p className="font-medium">{title}</p>
                  <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* A real fragment of the exam bar: the save status and server clock candidates will see. */}
        <div className="flex w-fit items-center gap-3 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm" aria-hidden>
          <span className="inline-flex items-center gap-1.5 text-[oklch(0.85_0.12_150)]">
            <CheckCircle2 className="size-4" />
            All answers saved
          </span>
          <span className="h-4 w-px bg-white/20" />
          <span className="font-mono tabular-nums">00:42:17</span>
          <span className="text-muted-foreground">remaining, server time</span>
        </div>
      </section>

      <section className="flex items-center justify-center px-4 py-12 sm:px-8">
        <div className="w-full max-w-sm">
          <Logo className="mb-10 lg:hidden" />
          <h2 className="font-display text-[1.75rem] font-semibold">Sign in</h2>
          <p className="mt-1.5 mb-8 text-sm text-muted-foreground">Use the account your institution created for you.</p>
          <LoginForm next={safeNext} />
          <p className="mt-10 text-xs text-muted-foreground">Technoverse 5.0 Web-e-Thon · Secure Examination Management System</p>
        </div>
      </section>
    </main>
  )
}
