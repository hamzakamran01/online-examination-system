"use server"

import { revalidatePath } from "next/cache"
import { requireRole } from "@/server/auth/guards"
import { runAction } from "@/server/errors"
import { createUser, resetPassword, updateUser } from "@/server/services/users"
import type { CreateUserInput, ResetPasswordInput, UpdateUserInput } from "@/lib/validation/users"

export async function createUserAction(input: CreateUserInput) {
  return runAction(async () => {
    const actor = await requireRole("admin")
    const r = await createUser(actor, input)
    revalidatePath("/admin")
    return r
  }, "Account created.")
}

export async function updateUserAction(input: UpdateUserInput) {
  return runAction(async () => {
    const actor = await requireRole("admin")
    await updateUser(actor, input)
    revalidatePath("/admin")
  }, "Account updated.")
}

export async function resetPasswordAction(input: ResetPasswordInput) {
  return runAction(async () => {
    const actor = await requireRole("admin")
    await resetPassword(actor, input)
  }, "Password reset. The user was signed out everywhere.")
}
