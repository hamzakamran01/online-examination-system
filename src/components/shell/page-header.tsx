import Link from "next/link"
import { ChevronLeft } from "lucide-react"
import { cn } from "@/lib/utils"

export function PageHeader({
  title,
  description,
  actions,
  back,
  eyebrow,
  className,
}: {
  title: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
  back?: { href: string; label: string }
  eyebrow?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("mb-8 space-y-3", className)}>
      {back && (
        <Link href={back.href} className="inline-flex items-center gap-1 rounded text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="size-4" aria-hidden />
          {back.label}
        </Link>
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 space-y-1.5">
          {eyebrow && <div className="flex flex-wrap items-center gap-2">{eyebrow}</div>}
          <h1 className="text-2xl font-semibold tracking-tight text-balance sm:text-[1.7rem]">{title}</h1>
          {description && <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  )
}

export function Panel({ className, ...props }: React.ComponentProps<"section">) {
  return <section className={cn("rounded-xl border bg-card shadow-panel", className)} {...props} />
}

export function PanelHeader({ title, description, actions }: { title: React.ReactNode; description?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 border-b px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <h2 className="font-semibold">{title}</h2>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

export function Stat({ label, value, hint, tone }: { label: string; value: React.ReactNode; hint?: React.ReactNode; tone?: "success" | "warning" | "info" }) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-panel">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-1 text-2xl font-semibold tabular-nums",
          tone === "success" && "text-success-text",
          tone === "warning" && "text-warning-text",
          tone === "info" && "text-info-text"
        )}
      >
        {value}
      </p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}
