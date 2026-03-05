import db from "@/lib/db"
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
  const result = await db.$transaction(async (tx) => {
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

    // Create pool members
    const investorMembers = await Promise.all(
      finalInvestors.map((inv) =>
        tx.poolMember.create({
          data: {
            poolId: pool.id,
            userId: inv.investor.userId,
            side: "INVESTOR",
            investorTier: inv.tier,
            displayName: [inv.investor.firstName, inv.investor.lastName]
              .filter(Boolean)
              .join(" "),
            email: inv.investor.email,
            engagementScore: inv.engagementScore,
          },
        })
      )
    )

    const founderMembers = await Promise.all(
      finalFounders.map((fnd) =>
        tx.poolMember.create({
          data: {
            poolId: pool.id,
            userId: fnd.userId,
            side: "FOUNDER",
            displayName: [fnd.firstName, fnd.lastName]
              .filter(Boolean)
              .join(" "),
            email: fnd.email,
            engagementScore: 0,
          },
        })
      )
    )

    // Create pairs with scores
    const pairs = []
    const scores = []
    let rank = 0

    for (const inv of finalInvestors) {
      const investorScores = pairScores.get(inv.investor.userId)
      if (!investorScores) continue

      for (const fnd of finalFounders) {
        const scoreBreakdown = investorScores.get(fnd.userId)
        if (!scoreBreakdown) continue

        rank++
        const pair = await tx.poolPair.create({
          data: {
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
          },
        })
        pairs.push(pair)

        const matchScore = await tx.matchScore.create({
          data: {
            poolPairId: pair.id,
            investorId: inv.investor.userId,
            founderId: fnd.userId,
            totalScore: scoreBreakdown.totalScore,
            industryScore: scoreBreakdown.industryScore,
            locationScore: scoreBreakdown.locationScore,
            stageScore: scoreBreakdown.stageScore,
            chequeSizeScore: scoreBreakdown.chequeSizeScore,
            engagementScore: scoreBreakdown.engagementScore,
          },
        })
        scores.push(matchScore)
      }
    }

    // Log event
    await tx.eventLedger.create({
      data: {
        type: "POOL_CREATED",
        poolId: pool.id,
        payload: {
          industry,
          investorCount: investorMembers.length,
          founderCount: founderMembers.length,
          pairCount: pairs.length,
        },
      },
    })

    return {
      pool,
      members: [...investorMembers, ...founderMembers],
      pairs,
      scores,
    }
  })

  return result
}
