import db from "@/lib/db"
import type { Prisma } from "@prisma/client"
import { POOL_DEFAULTS } from "@/lib/constants"
import { classifyUsers } from "./classify-users"
import { scoreInvestors } from "./score-investors"
import { findMatchingFounders } from "./build-pools"
import { applyFairnessConstraints } from "./fairness"
import { isTestMode } from "@/lib/email-test-mode"
import type {
  PoolGenerationRequest,
  PoolGenerationResult,
  ScoredInvestor,
} from "@/lib/types"

/**
 * Select investors using tiered fallback: HOT first, then WARM, then GAP_FILL.
 * Aims for targetCount, caps at maxCount, accepts down to MIN_POOL_MEMBERS.
 */
function selectInvestorsByTier(
  scored: ScoredInvestor[],
  targetCount: number,
  maxCount: number
): ScoredInvestor[] {
  const hot = scored.filter((s) => s.tier === "HOT")
  const warm = scored.filter((s) => s.tier === "WARM")
  const gapFill = scored.filter((s) => s.tier === "GAP_FILL")

  const selected: ScoredInvestor[] = []

  // Fill from HOT first (already sorted by engagement score)
  for (const inv of hot) {
    if (selected.length >= maxCount) break
    selected.push(inv)
  }

  // If below target, pull from WARM
  if (selected.length < targetCount) {
    for (const inv of warm) {
      if (selected.length >= maxCount) break
      selected.push(inv)
    }
  }

  // If still below absolute minimum, pull from GAP_FILL
  if (selected.length < POOL_DEFAULTS.MIN_POOL_MEMBERS) {
    for (const inv of gapFill) {
      if (selected.length >= maxCount) break
      selected.push(inv)
    }
  }

  return selected
}

/**
 * Orchestrator: Generate a pool for a given industry.
 * Uses tiered fallback with soft targets for flexible pool sizing.
 * Pipeline: classify → score → tier-select → build → soft-score → fairness → persist → present.
 */
export async function generatePool(
  request: PoolGenerationRequest
): Promise<PoolGenerationResult> {
  const {
    industry,
    slaHours = POOL_DEFAULTS.SLA_HOURS,
    ownerId,
    ownerName,
  } = request

  // Step 1: Classify users
  await classifyUsers()

  // Step 2: Score and tier investors
  const scoredInvestors = await scoreInvestors(industry)

  // Step 3: Select investors using tiered fallback (HOT → WARM → GAP_FILL)
  // Engagement scoring naturally pushes inactive users to GAP_FILL,
  // so the tiered fallback provides the "fall back to less engaged" behavior.
  const selectedInvestors = selectInvestorsByTier(
    scoredInvestors,
    POOL_DEFAULTS.TARGET_INVESTORS,
    POOL_DEFAULTS.MAX_POOL_MEMBERS
  )

  if (selectedInvestors.length < POOL_DEFAULTS.MIN_POOL_MEMBERS) {
    const tierCounts = {
      hot: scoredInvestors.filter((s) => s.tier === "HOT").length,
      warm: scoredInvestors.filter((s) => s.tier === "WARM").length,
      gapFill: scoredInvestors.filter((s) => s.tier === "GAP_FILL").length,
    }
    throw new Error(
      `Not enough eligible investors for ${industry}: found ${selectedInvestors.length}, ` +
        `need at least ${POOL_DEFAULTS.MIN_POOL_MEMBERS}. ` +
        `(Total scored: ${scoredInvestors.length} — HOT: ${tierCounts.hot}, ` +
        `WARM: ${tierCounts.warm}, GAP_FILL: ${tierCounts.gapFill})`
    )
  }

  // Steps 4-5: Find matching founders + soft score
  const excludeFounderIds = new Set<string>()
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

  const finalInvestors = fairness.validInvestors.slice(
    0,
    POOL_DEFAULTS.MAX_POOL_MEMBERS
  )
  const finalFounders = fairness.validFounders.slice(
    0,
    POOL_DEFAULTS.MAX_POOL_MEMBERS
  )

  if (finalInvestors.length < POOL_DEFAULTS.MIN_POOL_MEMBERS) {
    throw new Error(
      `After fairness: only ${finalInvestors.length} investors ` +
        `(need at least ${POOL_DEFAULTS.MIN_POOL_MEMBERS})`
    )
  }
  if (finalFounders.length < POOL_DEFAULTS.MIN_POOL_MEMBERS) {
    throw new Error(
      `After fairness: only ${finalFounders.length} founders ` +
        `(need at least ${POOL_DEFAULTS.MIN_POOL_MEMBERS})`
    )
  }

  // Persist: Create pool, members, pairs, scores, match presentation in a transaction
  // Timeout raised to 60s — real pools can generate hundreds of pairs + match selection
  const result = await db.$transaction(
    async (tx: Prisma.TransactionClient) => {
      // Create the pool
      const pool = await tx.pool.create({
        data: {
          industry,
          status: "DRAFT",
          minInvestors: POOL_DEFAULTS.MIN_POOL_MEMBERS,
          maxInvestors: POOL_DEFAULTS.MAX_POOL_MEMBERS,
          minFounders: POOL_DEFAULTS.MIN_POOL_MEMBERS,
          maxFounders: POOL_DEFAULTS.MAX_POOL_MEMBERS,
          slaHours,
          ownerId: ownerId ?? null,
          ownerName: ownerName ?? null,
          isTestPool: isTestMode(),
        },
      })

      // Batch-create investor members
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

      // Batch-create founder members
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

      // ─── Top-N Match Selection (Stage 1: Presentation) ────────
      // Each investor sees their top MATCHES_PER_INVESTOR founders (by pair score)
      // Each founder sees their top MATCHES_PER_FOUNDER investors (by pair score)
      // This determines what goes in the A1/B1 emails.

      const investorMembers = await tx.poolMember.findMany({
        where: { poolId: pool.id, side: "INVESTOR" },
      })

      for (const member of investorMembers) {
        const topPairs = await tx.poolPair.findMany({
          where: { poolId: pool.id, investorId: member.userId },
          orderBy: { score: "desc" },
          take: POOL_DEFAULTS.MATCHES_PER_INVESTOR,
        })

        if (topPairs.length > 0) {
          // Mark these pairs as presented to investor
          await tx.poolPair.updateMany({
            where: { id: { in: topPairs.map((p) => p.id) } },
            data: { presentedToInvestor: true },
          })

          // Update member: record which matches were shown, advance to stage 1
          await tx.poolMember.update({
            where: { id: member.id },
            data: {
              matchesPresentedIds: topPairs.map((p) => p.founderId),
              stage: 1,
            },
          })
        }
      }

      const founderMembers = await tx.poolMember.findMany({
        where: { poolId: pool.id, side: "FOUNDER" },
      })

      for (const member of founderMembers) {
        const topPairs = await tx.poolPair.findMany({
          where: { poolId: pool.id, founderId: member.userId },
          orderBy: { score: "desc" },
          take: POOL_DEFAULTS.MATCHES_PER_FOUNDER,
        })

        if (topPairs.length > 0) {
          // Mark these pairs as presented to founder
          await tx.poolPair.updateMany({
            where: { id: { in: topPairs.map((p) => p.id) } },
            data: { presentedToFounder: true },
          })

          // Update member: record which matches were shown, advance to stage 1
          await tx.poolMember.update({
            where: { id: member.id },
            data: {
              matchesPresentedIds: topPairs.map((p) => p.investorId),
              stage: 1,
            },
          })
        }
      }

      // Log event with tier breakdown
      await tx.eventLedger.create({
        data: {
          type: "POOL_CREATED",
          poolId: pool.id,
          payload: {
            industry,
            investorCount: finalInvestors.length,
            founderCount: finalFounders.length,
            pairCount: pairData.length,
            tierBreakdown: {
              hot: finalInvestors.filter((i) => i.tier === "HOT").length,
              warm: finalInvestors.filter((i) => i.tier === "WARM").length,
              gapFill: finalInvestors.filter((i) => i.tier === "GAP_FILL")
                .length,
            },
            isTestPool: isTestMode(),
          },
        },
      })

      // Fetch full pool with members and pairs for return
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
