"use client"

import { Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ConfirmAction, useAction } from "@/components/shell/common"
import { publishResultsAction } from "./actions"

export function PublishResultsButton({ examId, disabled, count }: { examId: string; disabled: boolean; count: number }) {
  const { run } = useAction()
  return (
    <ConfirmAction
      title="Publish results?"
      description={`${count} candidate${count === 1 ? "" : "s"} will see their score, per-question marks and your feedback. After publishing, any mark change needs a recorded reason and replaces previously issued reports.`}
      confirmLabel="Publish results"
      onConfirm={() => run(() => publishResultsAction(examId))}
      trigger={(open) => (
        <Button disabled={disabled} onClick={open}>
          <Send />
          Publish results
        </Button>
      )}
    />
  )
}
