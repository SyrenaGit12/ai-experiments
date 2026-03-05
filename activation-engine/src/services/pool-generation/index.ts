import db from "@/lib/db"
import type { Prisma } from "@prisma/client"
import { POOL_DEFAULTS } from "@/lib/constants"
import { classifyUsers } from "./classify-users"
import { scoreInvestors } from "./score-investors"
import { findMatchingFounders } from "./build-pools"
import { applyFairnessConstraints } from "./fairness"
import type { PoolGenerationRequest, PoolGenerationResult } from "@/lib/types"

/**
 * Orchestrator: Generate a pool for a given industry.
 * Executes the full 6-step pipeline: classify → score → build → soft-score → fairness → persist.
 */
export async function generatePool(
  request: PoolGenerationRequest
): Promise<PoolGenerationResult> {
  const {
    industry,
    minInvestors = POOL_DEFAULTS.MIN_INVESTORS,
    maxInvestors = POOL_DEFAULTS.MAX_INVESTORS,
    minFounders = POOL_DEFAULTS.MIN_FOUNDERS,
    maxFounders = POOL_DEFAULTS.MAX_FOUNDERS,
    slaHours = POOL_DEFAULTS.SLA_HOURS,
  } = request

  // Step 1: Classify users
  await classifyUsers()

  // Step 2: Score and tier investors
  const scoredInvestors = await scoreInvestors(industry)

  if (scoredInvestors.length < minInvestors) {
    throw new Error(
      `Not enough eligible investors for ${industry}: found ${scoredInvestors.length}, need ${minInvestors}`
    )
  }

  // Select top investors (prefer HOT tier)
  const selectedInvestors = scoredInvestors.slice(0, maxInvestors)

  // Steps 3-4: Find matching founders + soft score
  const excludeFounderIds = new Set<string>() // Could add existing pool members
  const { founders, pairScores } = await findMatchingFounders(
    industry,
    selectedInvestors,
    excludeFounderIds
  )

  // Step 6: Fairness constraints
  const fairness = await applyFairnessConstraints(selectedInvestors, founders)

  if (!fairness.viable) {
    throw new Error(`Pool not viable: ${fairness.reason}`)
  }

  const finalInvestors = fairness.validInvestors.slice(0, maxInvestors)
  const finalFounders = fairness.validFounders.slice(0, maxFounders)

  if (finalInvestors.length < minInvestors) {
    throw new Error(
      `After fairness: ${finalInvestors.length} investors (need ${minInvestors})`
    )
  }
  if (finalFounders.length < minFounders) {
    throw new Error(
      `After fairness: ${finalFounders.length} founders (need ${minFounders})`
    )
  }

  // Persist: Create pool, members, pairs, scores in a transaction
  // Timeout raised to 60s — real pools can generate hundreds of pairs
  const result = await db.$transaction(
    async (tx: Prisma.TransactionClient) => {
      // Create the pool
      const pool = await tx.pool.create({
        data: {
          industry,
          status: "DRAFT",
          minInvestors,
          maxInvestors,
          minFounders,
          maxFounders,
          slaHours,
        },
      })

      // Batch-create pool members
      await tx.poolMember.createMany({
        data: finalInvestors.map((inv) => ({
          poolId: pool.id,
          userId: inv.investor.userId,
          side: "INVESTOR" as const,
          investorTier: inv.tier,
          displayName: [inv.investor.firstName, inv.investor.lastName]
            .filter(Boolean)
            .join(" "),
          email: inv.investor.email,
          engagementScore: inv.engagementScore,
        })),
      })

      await tx.poolMember.createMany({
        data: finalFounders.map((fnd) => ({
          poolId: pool.id,
          userId: fnd.userId,
          side: "FOUNDER" as const,
          displayName: [fnd.firstName, fnd.lastName]
            .filter(Boolean)
            .join(" "),
          email: fnd.email,
          engagementScore: 0,
        })),
      })

      // Build pair + score data
      const pairData: Prisma.PoolPairCreateManyInput[] = []
      let rank = 0

      for (const inv of finalInvestors) {
        const investorScores = pairScores.get(inv.investor.userId)
        if (!investorScores) continue

        for (const fnd of finalFounders) {
          const scoreBreakdown = investorScores.get(fnd.userId)
          if (!scoreBreakdown) continue

          rank++
          pairData.push({
            poolId: pool.id,
            investorId: inv.investor.userId,
            founderId: fnd.userId,
            score: scoreBreakdown.totalScore,
            rank,
            investorName: [inv.investor.firstName, inv.investor.lastName]
              .filter(Boolean)
              .join(" "),
            investorEmail: inv.investor.email,
            founderName: [fnd.firstName, fnd.lastName]
              .filter(Boolean)
              .join(" "),
            founderEmail: fnd.email,
          })
        }
      }

      // Batch-create pairs
      await tx.poolPair.createMany({ data: pairData })

      // Fetch created pairs to get IDs for match scores
      const createdPairs = await tx.poolPair.findMany({
        where: { poolId: pool.id },
      })

      // Build a lookup: investorId:founderId → pairId
      const pairIdMap = new Map(
        createdPairs.map((p) => [`${p.investorId}:${p.founderId}`, p.id])
      )

      // Batch-create match scores
      const scoreData: Prisma.MatchScoreCreateManyInput[] = []

      for (const inv of finalInvestors) {
        const investorScores = pairScores.get(inv.investor.userId)
        if (!investorScores) continue

        for (const fnd of finalFounders) {
          const scoreBreakdown = investorScores.get(fnd.userId)
          if (!scoreBreakdown) continue

          const pairId = pairIdMap.get(
            `${inv.investor.userId}:${fnd.userId}`
          )
          if (!pairId) continue

          scoreData.push({
            poolPairId: pairId,
            investorId: inv.investor.userId,
            founderId: fnd.userId,
            totalScore: scoreBreakdown.totalScore,
            industryScore: scoreBreakdown.industryScore,
            locationScore: scoreBreakdown.locationScore,
            stageScore: scoreBreakdown.stageScore,
            chequeSizeScore: scoreBreakdown.chequeSizeScore,
            engagementScore: scoreBreakdown.engagementScore,
          })
        }
      }

      await tx.matchScore.createMany({ data: scoreData })

      // Log event
      await tx.eventLedger.create({
        data: {
          type: "POOL_CREATED",
          poolId: pool.id,
          payload: {
            industry,
            investorCount: finalInvestors.length,
            founderCount: finalFounders.length,
            pairCount: pairData.length,
          },
        },
      })

      // Fetch full pool with members for return
      const fullPool = await tx.pool.findUniqueOrThrow({
        where: { id: pool.id },
        include: { members: true, pairs: true },
      })

      return {
        pool: fullPool,
        members: fullPool.members,
        pairs: createdPairs,
        scores: [],
      }
    },
    { timeout: 60000 }
  )

  return result
}
