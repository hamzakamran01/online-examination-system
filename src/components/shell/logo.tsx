import { cn } from "@/lib/utils"

export function Logo({ className, compact }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5 font-semibold tracking-tight", className)}>
      <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground shadow-sm" aria-hidden>
        <svg viewBox="0 0 24 24" className="size-4.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 7.5 12 4l8 3.5-8 3.5-8-3.5Z" />
          <path d="M7 9.3V14c0 1.4 2.2 3 5 3s5-1.6 5-3V9.3" />
          <path d="M20 7.5V13" />
        </svg>
      </span>
      {!compact && <span className="text-[1.05rem]">ExamVault</span>}
    </span>
  )
}
