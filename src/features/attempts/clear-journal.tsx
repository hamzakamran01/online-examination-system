"use client"

import { useEffect } from "react"

/** The attempt is final: local journal entries for it are no longer needed. */
export function ClearJournal({ attemptId }: { attemptId: string }) {
  useEffect(() => {
    try {
      localStorage.removeItem(`ev:journal:${attemptId}`)
      localStorage.removeItem(`ev:seq:${attemptId}`)
    } catch {
      /* ignore */
    }
  }, [attemptId])
  return null
}
