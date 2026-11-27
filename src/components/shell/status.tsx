import { Badge } from "@/components/ui/badge"
import { STATUS_LABEL, STATUS_TONE, type EffectiveStatus } from "@/lib/domain/exam-status"
import { DIFFICULTY_LABEL, TYPE_LABEL } from "@/lib/validation/questions"

export function ExamStatusBadge({ status }: { status: EffectiveStatus }) {
  return (
    <Badge variant={STATUS_TONE[status]} className="gap-1.5">
      {status === "ongoing" && <span className="size-1.5 animate-pulse rounded-full bg-current" aria-hidden />}
      {STATUS_LABEL[status]}
    </Badge>
  )
}

export function DifficultyBadge({ difficulty }: { difficulty: keyof typeof DIFFICULTY_LABEL }) {
  const variant = difficulty === "easy" ? "success" : difficulty === "medium" ? "warning" : "danger"
  return <Badge variant={variant}>{DIFFICULTY_LABEL[difficulty]}</Badge>
}

export function TypeBadge({ type }: { type: keyof typeof TYPE_LABEL }) {
  return <Badge variant="outline">{TYPE_LABEL[type]}</Badge>
}
