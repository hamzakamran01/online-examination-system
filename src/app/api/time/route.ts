export const dynamic = "force-dynamic"

/** Authoritative server time for clock displays. No auth, no data: just the clock. */
export function GET() {
  return Response.json({ now: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } })
}
