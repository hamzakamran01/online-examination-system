import "server-only"
import { z } from "zod"

export type ErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION"
  | "CONFLICT"
  | "DEADLINE_PASSED"
  | "NOT_AVAILABLE"

const STATUS: Record<ErrorCode, number> = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION: 400,
  CONFLICT: 409,
  DEADLINE_PASSED: 409,
  NOT_AVAILABLE: 403,
}

/** Domain error with a user-safe message. Anything else is reported as a generic failure. */
export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public fields?: Record<string, string>
  ) {
    super(message)
  }
  get status() {
    return STATUS[this.code]
  }
}

/** Not found is used for foreign ids too, so existence is never leaked. */
export const notFound = (what = "Item") => new AppError("NOT_FOUND", `${what} not found.`)

export type ActionResult<T = undefined> =
  | { ok: true; data: T; message?: string }
  | { ok: false; code: ErrorCode | "INTERNAL"; message: string; fields?: Record<string, string> }

export function zodFields(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {}
  for (const issue of err.issues) {
    const key = issue.path.join(".") || "_"
    if (!out[key]) out[key] = issue.message
  }
  return out
}

/** Converts thrown errors into a serializable result for server actions. */
export function toActionError(e: unknown): Extract<ActionResult, { ok: false }> {
  if (e instanceof AppError) return { ok: false, code: e.code, message: e.message, fields: e.fields }
  if (e instanceof z.ZodError) return { ok: false, code: "VALIDATION", message: "Please fix the highlighted fields.", fields: zodFields(e) }
  console.error(e)
  return { ok: false, code: "INTERNAL", message: "Something went wrong on our side. Please try again." }
}

/** Wrap a server action body: validates nothing by itself, only normalizes errors. */
export async function runAction<T>(fn: () => Promise<T>, message?: string): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn(), message }
  } catch (e) {
    // Let Next.js control-flow errors (redirect, notFound) propagate.
    if (e && typeof e === "object" && "digest" in e && typeof (e as { digest: unknown }).digest === "string" && (e as { digest: string }).digest.startsWith("NEXT_")) throw e
    return toActionError(e)
  }
}

/** Route handler helper: same error mapping, JSON body. */
export function errorResponse(e: unknown) {
  const r = toActionError(e)
  const status = e instanceof AppError ? e.status : r.code === "VALIDATION" ? 400 : 500
  return Response.json({ error: { code: r.code, message: r.message, fields: r.fields } }, { status })
}
