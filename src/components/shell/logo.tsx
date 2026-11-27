import { cn } from "@/lib/utils"

/**
 * Mark: a sealed exam sheet. The folded corner reads as "paper", the check as
 * "verified". Drawn with the same stroke weight as the lucide icon set.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground", className)} aria-hidden>
      <svg viewBox="0 0 24 24" className="size-[1.1rem]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
        <path d="M14 3v5h5" />
        <path d="m9 14 2 2 4-4" />
      </svg>
    </span>
  )
}

export function Logo({ className, compact }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark />
      {!compact && <span className="font-display text-[1.06rem] font-semibold tracking-tight">ExamVault</span>}
    </span>
  )
}
