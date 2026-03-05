import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Only protect /control-tower routes
  if (pathname.startsWith("/control-tower")) {
    const auth = request.cookies.get("ct-auth")

    if (!auth || auth.value !== "authenticated") {
      return NextResponse.redirect(new URL("/login", request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/control-tower/:path*"],
}
