import db from "@/lib/db"
import type { CrossMatchResult, CrossMatchOutcome } from "@/lib/types"
import type { Prisma } from "@prisma/client"

/**
 * Detect cross-match outcomes for all presented pairs in a pool.
 *
 * Logic per pair:
 *   - Both sides selected each other → MUTUAL_YES
 *   - Investor selected but founder has NOT responded yet → PENDING
 *   - Founder selected but investor has NOT responded yet → PENDING
 *   - Investor selected, founder responded but didn't select → INVESTOR_ONLY
 *   - Founder selected, investor responded but didn't select → FOUNDER_ONLY
 *   - Both responded, neither selected → NO_MATCH
 *   - Neither has responded → PENDING
 *
 * "Responded" means the corresponding PoolMember has stage >= 2 (selection recorded).
 */
export async function detectCrossMatches(
  poolId: string
): Promise<CrossMatchResult[]> {
  const pool = await db.pool.findUnique({
    where: { id: poolId },
    include: {
      members: true,
      pairs: true,
    },
  })

  if (!pool) throw new Error(`Pool ${poolId} not found`)

  // Build lookup: userId → member (to check if they've responded)
  const memberByUserId = new Map(pool.members.map((m) => [m.userId, m]))

  const results: CrossMatchResult[] = []

  for (const pair of pool.pairs) {
    // Only process pairs that have been presented to at least one side
    if (!pair.presentedToInvestor && !pair.presentedToFounder) continue

    const investorMember = memberByUserId.get(pair.investorId)
    const founderMember = memberByUserId.get(pair.founderId)

    const investorResponded = investorMember ? investorMember.stage >= 2 : false
    const founderResponded = founderMember ? founderMember.stage >= 2 : false

    let outcome: CrossMatchOutcome

    if (pair.investorSelected && pair.founderSelected) {
      outcome = "MUTUAL_YES"
    } else if (pair.investorSelected && !pair.founderSelected) {
      outcome = founderResponded ? "INVESTOR_ONLY" : "PENDING"
    } else if (!pair.investorSelected && pair.founderSelected) {
      outcome = investorResponded ? "FOUNDER_ONLY" : "PENDING"
    } else {
      // Neither selected
      if (investorResponded && founderResponded) {
        outcome = "NO_MATCH"
      } else {
        outcome = "PENDING"
      }
    }

    results.push({
      pairId: pair.id,
      investorId: pair.investorId,
      founderId: pair.founderId,
      investorSelected: pair.investorSelected,
      founderSelected: pair.founderSelected,
      outcome,
    })
  }

  // Persist outcomes to PoolPair + MatchScore
  await db.$transaction(
    async (tx: Prisma.TransactionClient) => {
      for (const result of results) {
        await tx.poolPair.update({
          where: { id: result.pairId },
          data: { crossMatchOutcome: result.outcome },
        })

        // Also update MatchScore outcome
        const matchScoreOutcome = mapToMatchScoreOutcome(result.outcome)
        if (matchScoreOutcome) {
          await tx.matchScore.updateMany({
            where: { poolPairId: result.pairId },
            data: {
              outcome: matchScoreOutcome,
              outcomeAt: new Date(),
            },
          })
        }
      }
    },
    { timeout: 30000 }
  )

  return results
}

/**
 * Map CrossMatchOutcome to MatchScore.outcome values.
 * Only finalized outcomes (not PENDING) get persisted.
 */
function mapToMatchScoreOutcome(
  outcome: CrossMatchOutcome
): string | null {
  switch (outcome) {
    case "MUTUAL_YES":
      return "MUTUAL_YES"
    case "INVESTOR_ONLY":
    case "FOUNDER_ONLY":
      return "ONE_SIDED"
    case "NO_MATCH":
      return "NO_MATCH"
    case "PENDING":
      return null // Don't persist yet
  }
}

/**
 * Get the cross-match summary for a pool.
 */
export async function getCrossMatchSummary(poolId: string) {
  const pairs = await db.poolPair.findMany({
    where: { poolId },
    select: {
      id: true,
      investorId: true,
      founderId: true,
      investorName: true,
      founderName: true,
      investorSelected: true,
      founderSelected: true,
      crossMatchOutcome: true,
      presentedToInvestor: true,
      presentedToFounder: true,
      score: true,
    },
    orderBy: { score: "desc" },
  })

  const summary = {
    total: pairs.length,
    mutualYes: pairs.filter((p) => p.crossMatchOutcome === "MUTUAL_YES").length,
    investorOnly: pairs.filter((p) => p.crossMatchOutcome === "INVESTOR_ONLY").length,
    founderOnly: pairs.filter((p) => p.crossMatchOutcome === "FOUNDER_ONLY").length,
    noMatch: pairs.filter((p) => p.crossMatchOutcome === "NO_MATCH").length,
    pending: pairs.filter(
      (p) => p.crossMatchOutcome === "PENDING" || !p.crossMatchOutcome
    ).length,
  }

  return { pairs, summary }
}
