"use client"

import { Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ConfirmAction, useAction } from "@/components/shell/common"
import { publishExamAction } from "./actions"

export function PublishButton({ examId, ready }: { examId: string; ready: boolean }) {
  const { run } = useAction()
  return (
    <ConfirmAction
      title="Publish this exam?"
      description="Enrolled candidates will see it and can start when the window opens. Settings and questions lock after publishing."
      confirmLabel="Publish"
      onConfirm={() => run(() => publishExamAction(examId))}
      trigger={(open) => (
        <Button className="w-full" disabled={!ready} onClick={open}>
          <Send />
          Publish exam
        </Button>
      )}
    />
  )
}
