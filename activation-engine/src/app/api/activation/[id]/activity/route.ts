import { NextResponse } from "next/server"
import db from "@/lib/db"

/**
 * GET /api/activation/[id]/activity
 * Fetch the activity log for an activation record.
 * Returns newest first, limited to 100 entries by default.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const url = new URL(request.url)
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 100), 200)

  const logs = await db.activityLog.findMany({
    where: { activationRecordId: id },
    orderBy: { createdAt: "desc" },
    take: limit,
  })

  return NextResponse.json({ logs })
}
