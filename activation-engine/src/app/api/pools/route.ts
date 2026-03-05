import { NextResponse } from "next/server"
import db from "@/lib/db"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const status = searchParams.get("status")
  const industry = searchParams.get("industry")

  const pools = await db.pool.findMany({
    where: {
      ...(status ? { status: status as never } : {}),
      ...(industry ? { industry } : {}),
    },
    include: {
      _count: {
        select: { members: true, pairs: true },
      },
      members: {
        select: { side: true },
      },
    },
    orderBy: { createdAt: "desc" },
  })

  const enriched = pools.map((pool) => ({
    ...pool,
    investorCount: pool.members.filter((m) => m.side === "INVESTOR").length,
    founderCount: pool.members.filter((m) => m.side === "FOUNDER").length,
    members: undefined,
  }))

  return NextResponse.json(enriched)
}
