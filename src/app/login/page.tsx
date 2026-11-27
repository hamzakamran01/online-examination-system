import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { ArrowRight, Check, ShieldCheck } from "lucide-react"
import { getCurrentUser, homeFor } from "@/server/auth/guards"
import { LoginForm } from "./login-form"
import { Logo, LogoMark } from "@/components/shell/logo"
import { ContourLines } from "@/components/shell/decor"
import { SystemStatus } from "@/components/shell/system-status"

export const metadata: Metadata = { title: "Institution sign in" }

const essentials = [
  "Server-authoritative exam timing",
  "Local answer journal with retry on reconnect",
  "Reviewable signals and verifiable results",
]

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const user = await getCurrentUser()
  if (user) redirect(homeFor(user.role))
  const { next } = await searchParams
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : undefined

  return (
    <main id="main" className="grid min-h-dvh bg-canvas lg:grid-cols-[minmax(0,1.05fr)_minmax(27rem,0.95fr)]">
      <section
        className="surface-ink relative isolate flex min-h-[270px] flex-col justify-between overflow-hidden px-6 py-6 sm:px-10 sm:py-8 lg:min-h-dvh lg:px-14 lg:py-12"
        aria-label="ExamVault platform overview"
      >
        <div aria-hidden className="bg-grid-white pointer-events-none absolute inset-0 -z-10 opacity-60" />
        <ContourLines lines={14} seed={8} className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-[55%] w-full text-white/[0.1]" />
        <div className="flex items-center justify-between gap-3">
          <Link href="/" aria-label="ExamVault home" className="rounded-md">
            <span className="flex items-center gap-2.5">
              <LogoMark className="bg-white text-[oklch(0.3_0.06_192)]" />
              <span className="font-display text-lg font-semibold">ExamVault</span>
            </span>
          </Link>
          <span className="rounded-full border border-white/15 bg-white/[0.06] px-3 py-1 text-[0.65rem] font-semibold tracking-[0.11em] text-white/75 uppercase">
            Institutional access
          </span>
        </div>

        <div className="max-w-2xl py-8 lg:py-12">
          <p className="eyebrow text-[oklch(0.82_0.1_180)]">Assessment operations, connected</p>
          <h1 className="font-display mt-4 max-w-xl text-4xl leading-[1.03] font-semibold tracking-[-0.045em] sm:text-5xl xl:text-[3.6rem]">
            Examinations deserve clarity under pressure.
          </h1>
          <p className="mt-5 max-w-lg text-sm leading-6 text-white/70 sm:text-base sm:leading-7">
            A considered workspace for preparing exams, supporting candidates, reviewing evidence and publishing results.
          </p>
          <ul className="mt-7 flex flex-col gap-3">
            {essentials.map((item) => (
              <li key={item} className="flex items-center gap-3 text-sm text-white/85">
                <span className="grid size-6 shrink-0 place-items-center rounded-full border border-white/15 bg-white/[0.07] text-[oklch(0.82_0.1_180)]">
                  <Check className="size-3.5" aria-hidden />
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="hidden items-center gap-2 border-t border-white/15 pt-4 text-xs text-white/55 lg:flex">
          <ShieldCheck className="size-4 text-[oklch(0.82_0.1_180)]" aria-hidden />
          Built around server-side permissions and accountable exam workflows
        </div>
      </section>

      <section className="flex min-h-[calc(100dvh-270px)] flex-col items-center justify-center px-4 py-10 sm:px-8 lg:min-h-dvh lg:px-10">
        <div className="w-full max-w-[27rem]">
          <div className="mb-7 lg:hidden">
            <Logo />
          </div>
          <div className="rounded-2xl border border-border/80 bg-surface p-6 shadow-raised sm:p-8">
            <p className="eyebrow text-brand-text">Your institution’s workspace</p>
            <h2 className="font-display mt-2 text-3xl font-semibold tracking-tight">Welcome back</h2>
            <p className="mt-2 mb-7 text-sm leading-6 text-muted-foreground">
              Sign in with the account created for you by your institution.
            </p>
            <LoginForm next={safeNext} />
            <div className="mt-6 border-t pt-5">
              <p className="text-xs leading-5 text-muted-foreground">
                Need an account? Ask your institution administrator to create one for you.
              </p>
              <Link href="/" className="mt-4 inline-flex items-center gap-1.5 rounded text-xs font-medium text-brand-text hover:underline">
                Learn about ExamVault
                <ArrowRight className="size-3.5" aria-hidden />
              </Link>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-1">
            <SystemStatus />
            <Link href="/verify" className="inline-flex items-center gap-1.5 rounded text-xs font-medium text-brand-text hover:underline">
              <ShieldCheck className="size-3.5" aria-hidden />
              Verify a result report
            </Link>
          </div>
          <p className="mt-5 px-1 text-center text-[0.68rem] text-subtle-foreground">
            No public sign-up or social sign-in is enabled. Access is managed by your institution.
          </p>
        </div>
      </section>
    </main>
  )
}
