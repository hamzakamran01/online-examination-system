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
/** Explicit URL first, then Vercel's system variables (production domain, then this deployment). */
const vercelHost = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL
const baseURL = process.env.BETTER_AUTH_URL || (vercelHost ? `https://${vercelHost}` : "http://localhost:3000")
const trustedOrigins = [baseURL, process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`, process.env.VERCEL_BRANCH_URL && `https://${process.env.VERCEL_BRANCH_URL}`].filter(
  (o): o is string => Boolean(o)
)

export const auth = betterAuth({
  appName: "ExamVault",
  baseURL,
  trustedOrigins,
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
