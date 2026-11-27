import { NextResponse, type NextRequest } from "next/server"
import { getSessionCookie } from "better-auth/cookies"

/**
 * Optimistic redirect only: sends visitors without a session cookie to /login.
 * Real authorization happens in the service layer on every request (invariant 5).
 */
export function proxy(request: NextRequest) {
  if (getSessionCookie(request)) return NextResponse.next()
  const login = new URL("/login", request.url)
  login.searchParams.set("next", request.nextUrl.pathname)
  return NextResponse.redirect(login)
}

export const config = {
  matcher: ["/admin/:path*", "/examiner/:path*", "/candidate/:path*", "/attempt/:path*"],
}
