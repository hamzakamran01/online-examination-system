"use client"

import { useRouter } from "next/navigation"
import { Eye, Lock, RotateCcw, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ConfirmAction, useAction } from "@/components/shell/common"
import type { EffectiveStatus } from "@/lib/domain/exam-status"
import { closeExamAction, deleteExamAction, startSandboxAction, unpublishExamAction } from "./actions"

export function ExamLifecycleActions({ examId, status }: { examId: string; status: EffectiveStatus }) {
  const router = useRouter()
  const { run, pending } = useAction()

  return (
    <>
      <Button
        variant="outline"
        disabled={pending}
        onClick={() =>
          run(() => startSandboxAction(examId), {
            refresh: false,
            onOk: (d) => router.push(`/attempt/${(d as { attemptId: string }).attemptId}`),
          })
        }
      >
        <Eye />
        Preview as candidate
      </Button>

      {status === "draft" && (
        <ConfirmAction
          title="Delete this draft?"
          description="The draft and its question list are removed. Questions stay in your bank."
          confirmLabel="Delete draft"
          destructive
          onConfirm={() => run(() => deleteExamAction(examId), { onOk: () => router.push("/examiner") })}
          trigger={(open) => (
            <Button variant="ghost" onClick={open}>
              <Trash2 />
              Delete
            </Button>
          )}
        />
      )}

      {status === "published" && (
        <ConfirmAction
          title="Move back to draft?"
          description="Candidates will no longer see this exam until you publish it again. This is only possible before anyone starts."
          confirmLabel="Move to draft"
          onConfirm={() => run(() => unpublishExamAction(examId))}
          trigger={(open) => (
            <Button variant="ghost" onClick={open}>
              <RotateCcw />
              Unpublish
            </Button>
          )}
        />
      )}

      {(status === "published" || status === "ongoing") && (
        <ConfirmAction
          title="Close the exam now?"
          description="The window ends immediately. Anyone still writing is submitted with the answers already saved. This cannot be undone."
          confirmLabel="Close exam"
          destructive
          onConfirm={() => run(() => closeExamAction(examId))}
          trigger={(open) => (
            <Button variant="destructive" onClick={open}>
              <Lock />
              Close now
            </Button>
          )}
        />
      )}
    </>
  )
}
