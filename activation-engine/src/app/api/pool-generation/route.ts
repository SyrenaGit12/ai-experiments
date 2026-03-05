import { NextResponse } from "next/server"
import { generatePool } from "@/services/pool-generation"
import type { PoolGenerationRequest } from "@/lib/types"

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as PoolGenerationRequest

    if (!body.industry) {
      return NextResponse.json(
        { error: "industry is required" },
        { status: 400 }
      )
    }

    const result = await generatePool(body)

    return NextResponse.json({
      pool: result.pool,
      memberCount: result.members.length,
      pairCount: result.pairs.length,
      investors: result.members.filter((m) => m.side === "INVESTOR").length,
      founders: result.members.filter((m) => m.side === "FOUNDER").length,
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Pool generation failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
