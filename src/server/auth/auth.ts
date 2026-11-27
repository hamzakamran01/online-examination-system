import "server-only"
import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { nextCookies } from "better-auth/next-js"
import { eq } from "drizzle-orm"
import { db } from "@/server/db/client"
import * as schema from "@/server/db/schema"

/**
 * Better Auth: email + password with DB sessions.
 * Public sign-up is disabled: only administrators create accounts (C-3.1.2).
 * `role` and `active` are server-controlled fields (input: false), so a client
 * can never set them through the auth API.
 */
export const auth = betterAuth({
  appName: "ExamVault",
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: { user: schema.user, session: schema.session, account: schema.account, verification: schema.verification },
  }),
  emailAndPassword: { enabled: true, disableSignUp: true, minPasswordLength: 8 },
  session: { expiresIn: 60 * 60 * 12, updateAge: 60 * 60 },
  user: {
    additionalFields: {
      role: { type: "string", required: false, input: false, defaultValue: "candidate" },
      active: { type: "boolean", required: false, input: false, defaultValue: true },
    },
  },
  databaseHooks: {
    session: {
      create: {
        // Deactivated accounts cannot sign in.
        before: async (s) => {
          const [u] = await db
            .select({ active: schema.user.active })
            .from(schema.user)
            .where(eq(schema.user.id, s.userId))
            .limit(1)
          if (!u?.active) return false
        },
      },
    },
  },
  rateLimit: { enabled: true, window: 60, max: 30 },
  plugins: [nextCookies()],
})
