import { NextResponse } from "next/server"
import db from "@/lib/db"
import { generatePersonalizationForPool } from "@/services/personalization"

/**
 * POST /api/pools/[poolId]/personalize
 * Generate AI personalization lines for all presented pairs in a pool.
 *
 * Requires OPENAI_API_KEY in environment.
 * Skips pairs that already have personalization lines.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ poolId: string }> }
) {
  try {
    const { poolId } = await params

    const pool = await db.pool.findUnique({ where: { id: poolId } })
    if (!pool) {
      return NextResponse.json({ error: "Pool not found" }, { status: 404 })
    }

    if (pool.status === "CLOSED") {
      return NextResponse.json(
        { error: "Cannot generate personalization for closed pool" },
        { status: 400 }
      )
    }

    const result = await generatePersonalizationForPool(poolId)

    // Log event
    await db.eventLedger.create({
      data: {
        type: "MANUAL_OVERRIDE",
        actorId: "operator",
        poolId,
        payload: {
          action: "GENERATE_PERSONALIZATION",
          totalPairs: result.totalPairs,
          generated: result.generated,
          failed: result.failed,
          skipped: result.skipped,
        },
      },
    })

    return NextResponse.json(result)
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to generate personalization"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/**
 * GET /api/pools/[poolId]/personalize
 * List all personalization lines for a pool, grouped by pair.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ poolId: string }> }
) {
  try {
    const { poolId } = await params

    const pool = await db.pool.findUnique({ where: { id: poolId } })
    if (!pool) {
      return NextResponse.json({ error: "Pool not found" }, { status: 404 })
    }

    // Fetch all personalization lines for this pool's pairs
    const pairs = await db.poolPair.findMany({
      where: {
        poolId,
        OR: [
          { presentedToInvestor: true },
          { presentedToFounder: true },
        ],
      },
      include: {
        personalizationLines: {
          orderBy: { generatedAt: "desc" },
        },
      },
      orderBy: { score: "desc" },
    })

    // Summary stats
    const allLines = pairs.flatMap((p) => p.personalizationLines)
    const approved = allLines.filter((l) => l.approved).length
    const pending = allLines.filter((l) => !l.approved).length
    const totalPresentedPairs = pairs.length
    const pairsWithBothLines = pairs.filter((p) => {
      const hasInvestor = p.personalizationLines.some(
        (l) => l.side === "INVESTOR"
      )
      const hasFounder = p.personalizationLines.some(
        (l) => l.side === "FOUNDER"
      )
      return hasInvestor && hasFounder
    }).length
    const pairsFullyApproved = pairs.filter((p) => {
      const investorLine = p.personalizationLines.find(
        (l) => l.side === "INVESTOR"
      )
      const founderLine = p.personalizationLines.find(
        (l) => l.side === "FOUNDER"
      )
      return investorLine?.approved && founderLine?.approved
    }).length

    // Ready to send = all presented pairs have approved lines for the relevant side
    const readyToSendInvestor = pairs
      .filter((p) => p.presentedToInvestor)
      .every((p) =>
        p.personalizationLines.some(
          (l) => l.side === "INVESTOR" && l.approved
        )
      )
    const readyToSendFounder = pairs
      .filter((p) => p.presentedToFounder)
      .every((p) =>
        p.personalizationLines.some(
          (l) => l.side === "FOUNDER" && l.approved
        )
      )

    return NextResponse.json({
      pairs: pairs.map((p) => ({
        pairId: p.id,
        investorId: p.investorId,
        investorName: p.investorName,
        founderId: p.founderId,
        founderName: p.founderName,
        score: p.score,
        presentedToInvestor: p.presentedToInvestor,
        presentedToFounder: p.presentedToFounder,
        lines: p.personalizationLines,
      })),
      summary: {
        totalPresentedPairs,
        pairsWithBothLines,
        pairsFullyApproved,
        totalLines: allLines.length,
        approved,
        pending,
        readyToSendInvestor,
        readyToSendFounder,
      },
    })
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to fetch personalization lines"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/**
 * PATCH /api/pools/[poolId]/personalize
 * Approve, reject, or edit personalization lines.
 *
 * Body options:
 * - { action: "approve", lineIds: string[] }          — Approve specific lines
 * - { action: "approve_all" }                         — Approve all pending lines
 * - { action: "reject", lineIds: string[] }           — Reject (delete) specific lines
 * - { action: "edit", lineId: string, line: string }  — Edit a specific line's text
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ poolId: string }> }
) {
  try {
    const { poolId } = await params
    const body = await request.json()

    const pool = await db.pool.findUnique({ where: { id: poolId } })
    if (!pool) {
      return NextResponse.json({ error: "Pool not found" }, { status: 404 })
    }

    const { action } = body

    if (action === "approve" && Array.isArray(body.lineIds)) {
      const updated = await db.personalizationLine.updateMany({
        where: {
          id: { in: body.lineIds },
          poolPair: { poolId },
        },
        data: {
          approved: true,
          approvedAt: new Date(),
          approvedBy: body.approvedBy ?? "operator",
        },
      })

      return NextResponse.json({
        action: "approve",
        updated: updated.count,
      })
    }

    if (action === "approve_all") {
      const updated = await db.personalizationLine.updateMany({
        where: {
          poolPair: { poolId },
          approved: false,
        },
        data: {
          approved: true,
          approvedAt: new Date(),
          approvedBy: body.approvedBy ?? "operator",
        },
      })

      return NextResponse.json({
        action: "approve_all",
        updated: updated.count,
      })
    }

    if (action === "reject" && Array.isArray(body.lineIds)) {
      const deleted = await db.personalizationLine.deleteMany({
        where: {
          id: { in: body.lineIds },
          poolPair: { poolId },
        },
      })

      return NextResponse.json({
        action: "reject",
        deleted: deleted.count,
      })
    }

    if (action === "edit" && body.lineId && typeof body.line === "string") {
      const line = await db.personalizationLine.findFirst({
        where: {
          id: body.lineId,
          poolPair: { poolId },
        },
      })

      if (!line) {
        return NextResponse.json(
          { error: "Line not found in this pool" },
          { status: 404 }
        )
      }

      const updated = await db.personalizationLine.update({
        where: { id: body.lineId },
        data: {
          line: body.line.slice(0, 120),
          approved: false, // Reset approval after edit
          approvedAt: null,
          approvedBy: null,
        },
      })

      return NextResponse.json({
        action: "edit",
        line: updated,
      })
    }

    return NextResponse.json(
      {
        error:
          'Invalid action. Use "approve", "approve_all", "reject", or "edit"',
      },
      { status: 400 }
    )
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to update personalization"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
