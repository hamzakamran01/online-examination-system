import { z } from "zod"
export const preferencesSchema = z.object({
  fontScale: z.union([z.literal(90), z.literal(100), z.literal(115), z.literal(130)]),
  theme: z.enum(["system", "light", "dark", "contrast"]),
  layout: z.enum(["single", "scroll"]),
  paletteSide: z.enum(["left", "right"]),
})
export type Preferences = z.infer<typeof preferencesSchema>
export const defaults: Preferences = { fontScale: 100, theme: "system", layout: "single", paletteSide: "right" }
export const scratchSchema = z.object({
  attemptId: z.uuid(),
  text: z.string().max(20000, "Use at most 20,000 characters."),
})
