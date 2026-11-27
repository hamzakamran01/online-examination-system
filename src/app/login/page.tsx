import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { CheckCircle2, CloudOff, ShieldCheck, Timer } from "lucide-react"
import { getCurrentUser, homeFor } from "@/server/auth/guards"
import { LoginForm } from "./login-form"
import Link from "next/link"
import { Logo, LogoMark } from "@/components/shell/logo"
import { BubbleField, ContourLines, GuillocheBand, Microprint } from "@/components/shell/decor"
import { SystemStatus } from "@/components/shell/system-status"

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
      <section className="surface-ink relative isolate hidden overflow-hidden lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-16" aria-label="About ExamVault">
        {/* Background layers: lamp light, ruled exam paper, drafting grid, rosette watermark, seal. */}
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(80%_60%_at_100%_0%,oklch(0.42_0.08_180/0.55),transparent_60%),radial-gradient(60%_50%_at_0%_100%,oklch(0.3_0.07_230/0.6),transparent_70%)]" />
        <div aria-hidden className="bg-ruled pointer-events-none absolute inset-0 -z-10" />
        <div aria-hidden className="bg-grid-white pointer-events-none absolute inset-0 -z-10 opacity-60" />
        <ContourLines lines={18} seed={5} className="absolute inset-x-0 bottom-0 -z-10 h-[55%] w-full text-white/[0.09]" />
        <BubbleField rows={9} groups={2} seed={4} className="absolute top-28 right-12 -z-10 text-white/[0.14] xl:right-16" markedClassName="text-[oklch(0.82_0.1_180)]" />
        <Microprint className="absolute inset-x-0 top-0 px-12 pt-2 text-white/[0.13] xl:px-16" />
        <GuillocheBand className="absolute inset-x-0 bottom-0 text-white/[0.12]" />
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
                <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg border border-white/15 bg-white/[0.07] shadow-[inset_0_1px_0_rgb(255_255_255/0.12)] backdrop-blur-sm">
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
        <div className="flex w-fit items-center gap-3 rounded-lg border border-white/15 bg-white/[0.07] px-3 py-2 text-sm shadow-[inset_0_1px_0_rgb(255_255_255/0.1),0_12px_32px_-12px_rgb(0_0_0/0.6)] backdrop-blur-md" aria-hidden>
          <span className="inline-flex items-center gap-1.5 text-[oklch(0.85_0.12_150)]">
            <CheckCircle2 className="size-4" />
            All answers saved
          </span>
          <span className="h-4 w-px bg-white/20" />
          <span className="font-mono tabular-nums">00:42:17</span>
          <span className="text-muted-foreground">remaining, server time</span>
        </div>
      </section>

      <section className="relative isolate flex flex-col items-center justify-center overflow-hidden px-4 py-12 sm:px-8">
        <div aria-hidden className="bg-glow pointer-events-none absolute inset-0 -z-10" />
        <div aria-hidden className="bg-grid pointer-events-none absolute inset-0 -z-10" />
        <div className="w-full max-w-[25rem]">
          <Logo className="mb-10 lg:hidden" />
          <div className="rounded-2xl border bg-surface/90 p-6 shadow-raised backdrop-blur-sm sm:p-8">
            <p className="eyebrow text-brand-text">Secure sign-in</p>
            <h2 className="font-display mt-1.5 text-[1.75rem] font-semibold tracking-tight">Welcome to ExamVault</h2>
            <p className="mt-1.5 mb-7 text-sm text-muted-foreground">Use the account your institution created for you.</p>
            <LoginForm next={safeNext} />
          </div>
          <div className="mt-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-1">
            <SystemStatus className="-ml-2" />
            <Link href="/verify" className="inline-flex items-center gap-1.5 rounded text-xs font-medium text-brand-text hover:underline">
              <ShieldCheck className="size-3.5" aria-hidden />
              Verify a result report
            </Link>
          </div>
          <p className="mt-6 px-1 text-xs text-subtle-foreground">Technoverse 5.0 Web-e-Thon · Secure Examination Management System</p>
        </div>
      </section>
    </main>
  )
}
