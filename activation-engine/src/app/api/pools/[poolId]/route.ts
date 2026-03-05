import { NextResponse } from "next/server"
import db from "@/lib/db"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ poolId: string }> }
) {
  const { poolId } = await params

  const pool = await db.pool.findUnique({
    where: { id: poolId },
    include: {
      members: { orderBy: { side: "asc" } },
      pairs: {
        include: { matchScore: true },
        orderBy: { score: "desc" },
      },
      events: {
        orderBy: { createdAt: "desc" },
        take: 50,
      },
    },
  })

  if (!pool) {
    return NextResponse.json({ error: "Pool not found" }, { status: 404 })
  }

  return NextResponse.json(pool)
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ poolId: string }> }
) {
  const { poolId } = await params
  const body = await request.json()

  const pool = await db.pool.update({
    where: { id: poolId },
    data: body,
  })

  return NextResponse.json(pool)
}
