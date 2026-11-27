import Link from "next/link"
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Check,
  ClipboardCheck,
  Clock3,
  FileCheck2,
  LifeBuoy,
  LockKeyhole,
  ShieldCheck,
  Signal,
  Users,
  Wifi,
} from "lucide-react"
import { Logo, LogoMark } from "@/components/shell/logo"
import { ContourLines, GuillocheBand } from "@/components/shell/decor"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { ProductPreview } from "./product-preview"
import { RecoveryDemo } from "./recovery-demo"
import { MarketingScrollReveal } from "./scroll-reveal"

const principles = [
  { icon: Clock3, title: "Server-authoritative timing", detail: "The exam clock is not the device clock." },
  { icon: Wifi, title: "Outage-aware answers", detail: "Local journaling helps preserve work through interruptions." },
  { icon: ShieldCheck, title: "Accountable decisions", detail: "Review context, grading and published results stay connected." },
]

const roles = [
  {
    icon: Users,
    title: "Administrators",
    detail: "Manage accounts, roles and platform activity.",
    label: "Platform oversight",
  },
  {
    icon: ClipboardCheck,
    title: "Examiners",
    detail: "Build papers, enroll candidates, monitor and grade.",
    label: "Exam operations",
  },
  {
    icon: FileCheck2,
    title: "Candidates",
    detail: "Access assigned exams and see results when released.",
    label: "Candidate access",
  },
]

const workflow = [
  {
    number: "01",
    title: "Prepare with intent",
    detail: "Build from a reusable question bank, set the exam window and enroll the right candidates.",
    icon: ClipboardCheck,
  },
  {
    number: "02",
    title: "Run with visibility",
    detail: "Keep an eye on progress and connection signals without treating a signal as a verdict.",
    icon: Signal,
  },
  {
    number: "03",
    title: "Review with evidence",
    detail: "Grade, resolve questions fairly and publish results with a verifiable report trail.",
    icon: ShieldCheck,
  },
]

export function LandingPage() {
  return (
    <main id="main" className="marketing-page">
      <MarketingScrollReveal />
      <section className="marketing-hero">
        <div className="marketing-hero-grid" aria-hidden />
        <div className="marketing-hero-dots" aria-hidden />
        <div className="marketing-hero-orbit" aria-hidden />
        <header className="marketing-nav-wrap">
          <nav className="marketing-nav" aria-label="Main navigation">
            <Link href="/" aria-label="ExamVault home" className="rounded-md">
              <span className="flex items-center gap-2.5">
                <LogoMark className="bg-sidebar-primary text-primary-foreground" />
                <span className="font-display text-lg font-semibold tracking-tight text-sidebar-foreground">ExamVault</span>
              </span>
            </Link>
            <div className="hidden items-center gap-7 md:flex">
              <a className="marketing-nav-link" href="#workflow">How it works</a>
              <a className="marketing-nav-link" href="#resilience">Resilience</a>
              <a className="marketing-nav-link" href="#trust">Trust</a>
            </div>
            <Link
              href="/login"
              className={cn(
                buttonVariants({ size: "sm" }),
                "h-9 border border-sidebar-border bg-sidebar-accent px-4 text-sidebar-foreground shadow-none hover:bg-sidebar-accent/80 hover:text-sidebar-foreground"
              )}
            >
              Sign in
              <ArrowUpRight data-icon="inline-end" />
            </Link>
          </nav>
        </header>

        <div className="marketing-hero-content">
          <div className="marketing-hero-copy animate-soft-rise">
            <p className="marketing-eyebrow"><span className="marketing-eyebrow-dot" /> Assessment operations, built for real conditions</p>
            <h1 className="font-display text-5xl leading-[0.98] font-semibold tracking-[-0.055em] sm:text-6xl xl:text-[4.65rem]">
              When the connection falters, <span className="marketing-title-accent">the exam shouldn’t.</span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-sidebar-foreground/75 sm:text-lg sm:leading-8">
              ExamVault brings exam setup, candidate delivery, live oversight and result review into one accountable workflow.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/login" className={cn(buttonVariants({ size: "lg" }), "h-11 px-5 text-sm")}>
                Sign in to your institution
                <ArrowRight data-icon="inline-end" />
              </Link>
              <a
                href="#workflow"
                className="inline-flex h-11 items-center gap-2 rounded-lg border border-sidebar-border bg-sidebar-accent/60 px-4 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent"
              >
                Explore the workflow
                <ArrowDown className="size-4" aria-hidden />
              </a>
            </div>
            <p className="mt-4 text-xs leading-5 text-sidebar-foreground/60">
              Accounts are created by your institution administrator. No public sign-up is available.
            </p>
          </div>

          <ProductPreview />
        </div>

        <div className="marketing-principles" aria-label="Product principles">
          {principles.map(({ icon: Icon, title, detail }, index) => (
            <div key={title} className="marketing-principle" data-scroll-reveal data-reveal-order={index + 1}>
              <span className="marketing-principle-icon"><Icon className="size-4" aria-hidden /></span>
              <span className="min-w-0">
                <span className="block text-xs font-semibold text-sidebar-foreground">{title}</span>
                <span className="mt-1 block text-xs leading-5 text-sidebar-foreground/60">{detail}</span>
              </span>
            </div>
          ))}
        </div>
      </section>

      <section id="workflow" className="marketing-section marketing-workflow-section">
        <ContourLines lines={16} seed={12} className="marketing-workflow-contours absolute top-0 right-0 h-56 w-[58%] text-brand/20" />
        <div className="marketing-section-heading marketing-layer" data-scroll-reveal>
          <p className="marketing-kicker">One connected workflow</p>
          <h2 className="marketing-heading">Every exam has a before, a during and an after.</h2>
          <p className="marketing-lede">
            ExamVault keeps the work around an assessment connected, from the first question to the final published result.
          </p>
        </div>
        <div className="marketing-workflow-grid marketing-layer">
          {workflow.map(({ number, title, detail, icon: Icon }, index) => (
            <article key={number} className="marketing-workflow-card" data-scroll-reveal data-reveal-order={index + 1}>
              <div className="flex items-start justify-between gap-3">
                <span className="marketing-workflow-icon"><Icon className="size-5" aria-hidden /></span>
                <span className="font-mono text-xs font-medium tabular-nums text-subtle-foreground">{number} / 03</span>
              </div>
              <h3 className="mt-7 font-display text-xl font-semibold tracking-tight">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="resilience" className="marketing-section marketing-resilience-section">
        <ContourLines lines={22} seed={19} className="marketing-resilience-contours absolute inset-y-0 right-0 h-full w-[62%] text-brand/15" />
        <div className="marketing-resilience-copy marketing-layer" data-scroll-reveal>
          <p className="marketing-kicker">Failure-resilient by design</p>
          <h2 className="marketing-heading">A network interruption should not erase a candidate’s work.</h2>
          <p className="marketing-lede">
            Answers are journaled locally and synchronized when possible. The server remains the source of truth for deadlines, while examiners receive measured context for review.
          </p>
          <div className="mt-6 flex flex-col gap-3">
            {[
              "Answer changes are kept locally before sync.",
              "Reconnects do not pause or extend the server deadline.",
              "Connection events are signals for review, not proof.",
            ].map((text) => (
              <p key={text} className="flex items-start gap-2.5 text-sm leading-6 text-foreground/85">
                <Check className="mt-1 size-4 shrink-0 text-brand-text" aria-hidden />
                {text}
              </p>
            ))}
          </div>
        </div>
        <div className="marketing-layer" data-scroll-reveal>
          <RecoveryDemo />
        </div>
      </section>

      <section id="trust" className="marketing-section marketing-trust-section">
        <div className="marketing-trust-header marketing-layer" data-scroll-reveal>
          <div>
            <p className="marketing-kicker">Trust is a process</p>
            <h2 className="marketing-heading">Clear rules for candidates. Useful evidence for examiners.</h2>
          </div>
          <p className="marketing-lede">
            Build confidence with accountable review, not claims of perfect prevention. Each role sees only what it needs to do its work.
          </p>
        </div>
        <div className="marketing-trust-grid marketing-layer">
          <article className="marketing-trust-feature" data-scroll-reveal data-reveal-order="1">
            <div className="marketing-trust-icon"><LockKeyhole className="size-5" aria-hidden /></div>
            <h3>Role-aware access</h3>
            <p>Administrators, examiners and candidates have distinct experiences, with permissions checked on the server.</p>
          </article>
          <article className="marketing-trust-feature" data-scroll-reveal data-reveal-order="2">
            <div className="marketing-trust-icon"><LifeBuoy className="size-5" aria-hidden /></div>
            <h3>Review with context</h3>
            <p>Grading history, outage evidence and candidate disputes support a transparent resolution workflow.</p>
          </article>
          <article className="marketing-trust-feature" data-scroll-reveal data-reveal-order="3">
            <div className="marketing-trust-icon"><ShieldCheck className="size-5" aria-hidden /></div>
            <h3>Results people can verify</h3>
            <p>Issued reports can be checked by code, while the public verification view exposes only minimum information.</p>
          </article>
        </div>
        <div className="marketing-trust-note marketing-layer" data-scroll-reveal>
          <span className="marketing-trust-note-mark"><ShieldCheck className="size-5" aria-hidden /></span>
          <p><strong>Security with honest boundaries.</strong> Browser-based exams can detect some events, but cannot lock down an operating system or prevent every form of outside assistance.</p>
        </div>
      </section>

      <section className="marketing-section marketing-audience-section" aria-labelledby="audience-title">
        <GuillocheBand className="marketing-audience-rule absolute inset-x-0 bottom-0 h-2 text-primary" />
        <div className="marketing-audience-copy marketing-layer" data-scroll-reveal>
          <p className="marketing-kicker">Designed around the people involved</p>
          <h2 id="audience-title" className="marketing-heading">One platform. Three clear responsibilities.</h2>
          <p className="marketing-lede">Each role gets a focused workspace for the decisions and tasks they own.</p>
        </div>
        <div className="marketing-role-grid marketing-layer">
          {roles.map(({ icon: Icon, title, detail, label }, index) => (
            <Link key={title} href="/login" className="marketing-role-card" data-scroll-reveal data-reveal-order={index + 1}>
              <div className="flex items-center justify-between gap-3">
                <span className="marketing-role-icon"><Icon className="size-5" aria-hidden /></span>
                <span className="text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-subtle-foreground">{label}</span>
              </div>
              <h3 className="mt-5 text-base font-semibold">{title}</h3>
              <p className="mt-1.5 min-h-12 text-sm leading-6 text-muted-foreground">{detail}</p>
              <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-brand-text">
                Continue to sign in
                <ArrowUpRight className="size-4" aria-hidden />
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="marketing-close" data-scroll-reveal>
        <div className="marketing-close-decoration" aria-hidden />
        <div className="relative">
          <p className="marketing-kicker marketing-kicker-light">Start with the right kind of access</p>
          <h2 className="font-display max-w-2xl text-3xl leading-tight font-semibold tracking-tight sm:text-4xl">
            Bring your institution’s exam workflow into one place.
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-6 text-sidebar-foreground/70">
            Sign in with the account provided by your institution. If you need access, contact your administrator.
          </p>
        </div>
        <Link href="/login" className={cn(buttonVariants({ size: "lg" }), "relative h-11 shrink-0 px-5")}>
          Go to sign in
          <ArrowRight data-icon="inline-end" />
        </Link>
      </section>

      <footer className="marketing-footer" data-scroll-reveal>
        <Link href="/" aria-label="ExamVault home" className="rounded-md">
          <Logo />
        </Link>
        <p>Secure examination management, with resilience and accountability built into the workflow.</p>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
          <Link className="marketing-footer-link" href="/login">Institution sign in</Link>
          <Link className="marketing-footer-link" href="/verify">Verify a report</Link>
        </div>
      </footer>
    </main>
  )
}
