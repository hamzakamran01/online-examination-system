"use server"

import { requireRole } from "@/server/auth/guards"
import { runAction } from "@/server/errors"
import { grantExtension, postAnnouncement } from "@/server/services/monitoring"
import type { AnnouncementInput, ExtensionInput } from "@/lib/validation/monitoring"

export async function postAnnouncementAction(examId: string, input: AnnouncementInput) {
  return runAction(async () => {
    const actor = await requireRole("examiner")
    return postAnnouncement(actor, examId, input)
  }, "Announcement sent. Candidates will see it within 15 seconds.")
}

export async function grantExtensionAction(input: ExtensionInput) {
  return runAction(async () => {
    const actor = await requireRole("examiner")
    return grantExtension(actor, input)
  }, "Extra time granted. The candidate's timer updates within 15 seconds.")
}
