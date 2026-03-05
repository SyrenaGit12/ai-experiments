import { NextResponse } from "next/server"

/**
 * GET /api/config
 * Public config values for the Control Tower UI.
 */
export async function GET() {
  return NextResponse.json({
    testMode: process.env.EMAIL_TEST_MODE === "true",
  })
}
