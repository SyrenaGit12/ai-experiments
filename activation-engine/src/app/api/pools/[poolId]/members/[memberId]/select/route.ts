import { NextResponse } from "next/server"
import db from "@/lib/db"
import { detectCrossMatches } from "@/services/pool-generation/cross-match"
import type { Prisma } from "@prisma/client"

/**
 * POST /api/pools/[poolId]/members/[memberId]/select
 * Record a member's match selections (Stage 2).
 *
 * Body: { selectedMatchIds: string[] }
 *   - For INVESTOR members: can select multiple founders (up to their presented list)
 *   - For FOUNDER members: can select one or more investors from their presented list
 *
 * Validation:
 *   - Pool must be ACTIVE
 *   - Member must be at stage 1 (presented) — not already selected
 *   - selectedMatchIds must be a subset of member.matchesPresentedIds
 *
 * After recording:
 *   - Updates PoolPair investorSelected / founderSelected flags
 *   - Advances member to stage 2
 *   - Runs cross-match detection for the entire pool
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ poolId: string; memberId: string }> }
) {
  const { poolId, memberId } = await params

  const body = await request.json()
  const selectedMatchIds: string[] = body.selectedMatchIds

  if (!Array.isArray(selectedMatchIds)) {
    return NextResponse.json(
      { error: "selectedMatchIds must be an array of user IDs" },
      { status: 400 }
    )
  }

  // ── Load pool + member ──────────────────────────────────
  const pool = await db.pool.findUnique({
    where: { id: poolId },
    include: { members: true, pairs: true },
  })

  if (!pool) {
    return NextResponse.json({ error: "Pool not found" }, { status: 404 })
  }

  if (pool.status !== "ACTIVE") {
    return NextResponse.json(
      { error: `Cannot record selections for pool in ${pool.status} status. Pool must be ACTIVE.` },
      { status: 400 }
    )
  }

  const member = pool.members.find((m) => m.id === memberId)
  if (!member) {
    return NextResponse.json(
      { error: "Member not found in this pool" },
      { status: 404 }
    )
  }

  if (member.stage !== 1) {
    return NextResponse.json(
      {
        error:
          member.stage === 0
            ? "Member has not been presented matches yet (stage 0). Matches must be presented first."
            : `Member already at stage ${member.stage}. Selections can only be recorded at stage 1.`,
      },
      { status: 400 }
    )
  }

  // ── Validate selections against presented matches ───────
  const presentedIds = (member.matchesPresentedIds as string[]) ?? []

  const invalidIds = selectedMatchIds.filter(
    (id) => !presentedIds.includes(id)
  )

  if (invalidIds.length > 0) {
    return NextResponse.json(
      {
        error: `Invalid selections. These IDs were not in the member's presented matches: ${invalidIds.join(", ")}`,
        presentedIds,
      },
      { status: 400 }
    )
  }

  // ── Record selections in a transaction ──────────────────
  const selectedSet = new Set(selectedMatchIds)

  await db.$transaction(
    async (tx: Prisma.TransactionClient) => {
      // Update the member
      await tx.poolMember.update({
        where: { id: memberId },
        data: {
          stage: 2,
          selectedMatchIds: selectedMatchIds,
          respondedAt: new Date(),
        },
      })

      // Update PoolPair flags for each presented pair
      for (const pair of pool.pairs) {
        if (member.side === "INVESTOR") {
          // This investor is selecting founders
          if (
            pair.investorId === member.userId &&
            pair.presentedToInvestor
          ) {
            await tx.poolPair.update({
              where: { id: pair.id },
              data: {
                investorSelected: selectedSet.has(pair.founderId),
              },
            })
          }
        } else {
          // This founder is selecting investors
          if (
            pair.founderId === member.userId &&
            pair.presentedToFounder
          ) {
            await tx.poolPair.update({
              where: { id: pair.id },
              data: {
                founderSelected: selectedSet.has(pair.investorId),
              },
            })
          }
        }
      }

      // Log event
      await tx.eventLedger.create({
        data: {
          type: "RESPONSE_PARSED",
          actorId: "operator",
          poolId,
          payload: {
            memberId,
            memberUserId: member.userId,
            memberSide: member.side,
            selectedMatchIds,
            selectedCount: selectedMatchIds.length,
            presentedCount: presentedIds.length,
          },
        },
      })
    },
    { timeout: 30000 }
  )

  // ── Run cross-match detection ───────────────────────────
  const crossMatchResults = await detectCrossMatches(poolId)

  const mutualCount = crossMatchResults.filter(
    (r) => r.outcome === "MUTUAL_YES"
  ).length

  return NextResponse.json({
    success: true,
    memberId,
    side: member.side,
    selectedCount: selectedMatchIds.length,
    crossMatch: {
      total: crossMatchResults.length,
      mutualYes: mutualCount,
      pending: crossMatchResults.filter((r) => r.outcome === "PENDING").length,
      noMatch: crossMatchResults.filter((r) => r.outcome === "NO_MATCH").length,
    },
  })
}
