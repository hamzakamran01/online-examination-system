import { z } from "zod"

export const ROLES = ["admin", "examiner", "candidate"] as const

const name = z.string().trim().min(2, "Name must be at least 2 characters.").max(80, "Name is too long.")
const password = z
  .string()
  .min(8, "Use at least 8 characters.")
  .max(72, "Use at most 72 characters.")
  .regex(/[A-Za-z]/, "Include at least one letter.")
  .regex(/[0-9]/, "Include at least one number.")

export const createUserSchema = z.object({
  name,
  email: z.email("Enter a valid email address.").trim().toLowerCase(),
  role: z.enum(ROLES, "Choose a role."),
  password,
})
export type CreateUserInput = z.infer<typeof createUserSchema>

export const updateUserSchema = z.object({
  id: z.string().min(1),
  name,
  role: z.enum(ROLES, "Choose a role."),
  active: z.boolean(),
})
export type UpdateUserInput = z.infer<typeof updateUserSchema>

export const resetPasswordSchema = z.object({ id: z.string().min(1), password })
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>
