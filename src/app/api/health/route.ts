import { sql } from "drizzle-orm"
import { db } from "@/server/db/client"
import { authBaseURL, authTrustedOrigins } from "@/server/auth/auth"

export const dynamic = "force-dynamic"

/**
 * Deployment diagnostics. Reports whether configuration is present and the
 * database answers. Never returns secret values.
 */
export async function GET(req: Request) {
  const origin = new URL(req.url).origin
  let database: "ok" | "error" = "ok"
  let databaseError: string | undefined
  try {
    await db.execute(sql`select 1`)
  } catch (e) {
    database = "error"
    databaseError = e instanceof Error ? e.message.slice(0, 120) : "unknown"
  }
  const body = {
    status: database === "ok" && process.env.BETTER_AUTH_SECRET ? "ok" : "misconfigured",
    database,
    databaseError,
    env: {
      DATABASE_URL: Boolean(process.env.DATABASE_URL),
      BETTER_AUTH_SECRET: Boolean(process.env.BETTER_AUTH_SECRET),
      BETTER_AUTH_URL: process.env.BETTER_AUTH_URL ?? null,
    },
    auth: { baseURL: authBaseURL, requestOrigin: origin, originTrusted: authTrustedOrigins.includes(origin) },
    serverTime: new Date().toISOString(),
  }
  return Response.json(body, { status: body.status === "ok" ? 200 : 503, headers: { "Cache-Control": "no-store" } })
}
