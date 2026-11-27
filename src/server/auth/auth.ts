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
const https = (host?: string) => (host ? `https://${host}` : undefined)
const vercelHost = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL
// Normalize: "https://x.app/" and "https://x.app" must compare equal in the origin check.
export const authBaseURL = (process.env.BETTER_AUTH_URL || https(vercelHost) || "http://localhost:3000").replace(/\/+$/, "")
const baseURL = authBaseURL
/** Only this project's own addresses may post to the auth API (CSRF origin check). */
export const authTrustedOrigins = [
  baseURL,
  https(process.env.VERCEL_PROJECT_PRODUCTION_URL),
  https(process.env.VERCEL_URL),
  https(process.env.VERCEL_BRANCH_URL),
  ...(process.env.NODE_ENV !== "production" ? ["http://localhost:3000", "http://127.0.0.1:3000"] : []),
].filter((o, i, all): o is string => Boolean(o) && all.indexOf(o) === i)
const trustedOrigins = authTrustedOrigins

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
