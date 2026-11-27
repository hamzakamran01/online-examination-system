import { cn } from "@/lib/utils"

export function Logo({
  className,
  compact,
  inverse,
}: {
  className?: string
  compact?: boolean
  inverse?: boolean
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5 font-semibold tracking-tight", className)}>
      <span
        className={cn(
          "grid size-8 place-items-center rounded-md shadow-sm",
          inverse ? "bg-seal text-ink" : "bg-primary text-primary-foreground"
        )}
        aria-hidden
      >
        <svg viewBox="0 0 24 24" className="size-4.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 7.5 12 4l8 3.5-8 3.5-8-3.5Z" />
          <path d="M7 9.3V14c0 1.4 2.2 3 5 3s5-1.6 5-3V9.3" />
          <path d="M20 7.5V13" />
        </svg>
      </span>
      {!compact && (
        <span className="flex flex-col leading-none">
          <span className="font-heading text-[1.15rem] font-medium">ExamVault</span>
          <span className="mt-0.5 text-[0.62rem] font-medium tracking-[0.16em] text-muted-foreground uppercase">Examination registry</span>
        </span>
      )}
    </span>
  )
}
