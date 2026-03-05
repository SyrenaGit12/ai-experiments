import { NextResponse } from "next/server"
import db from "@/lib/db"

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ poolId: string }> }
) {
  const { poolId } = await params

  const pool = await db.pool.findUnique({ where: { id: poolId } })

  if (!pool) {
    return NextResponse.json({ error: "Pool not found" }, { status: 404 })
  }

  if (pool.status !== "DRAFT") {
    return NextResponse.json(
      { error: `Cannot approve pool in ${pool.status} status` },
      { status: 400 }
    )
  }

  const updated = await db.$transaction(async (tx) => {
    const approved = await tx.pool.update({
      where: { id: poolId },
      data: {
        status: "APPROVED",
        approvedBy: "operator",
        approvedAt: new Date(),
      },
    })

    // Update all members to ACTIVE
    await tx.poolMember.updateMany({
      where: { poolId, status: "PENDING" },
      data: { status: "ACTIVE" },
    })

    // Log event
    await tx.eventLedger.create({
      data: {
        type: "POOL_APPROVED",
        actorId: "operator",
        poolId,
        payload: { industry: pool.industry },
      },
    })

    return approved
  })

  return NextResponse.json(updated)
}
