import { NextResponse } from "next/server"
import { cookies } from "next/headers"

const COOKIE_NAME = "ct-auth"

export async function POST(request: Request) {
  const body = await request.json()
  const { password } = body

  if (password !== process.env.CONTROL_TOWER_PASSWORD) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 })
  }

  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, "authenticated", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: "/",
  })

  return NextResponse.json({ success: true })
}

export async function DELETE() {
  const cookieStore = await cookies()
  cookieStore.delete(COOKIE_NAME)
  return NextResponse.json({ success: true })
}
