import { sql } from "@/lib/syrena"
import { POOL_DEFAULTS } from "@/lib/constants"
import { computePairScore } from "./soft-scoring"
import type { ScoredInvestor } from "@/lib/types"
import type { FounderWithUser } from "@/lib/syrena-types"

/**
 * Steps 3-4: Build pool by finding matching founders for selected investors.
 * - Hard filter: industry overlap, not blocked, not in active pool
 * - Soft score: multi-factor scoring
 * - Select top 3-6 founders by aggregate pair scores
 */
export async function findMatchingFounders(
  industry: string,
  selectedInvestors: ScoredInvestor[],
  excludeFounderIds: Set<string>
): Promise<{
  founders: FounderWithUser[]
  pairScores: Map<string, Map<string, ReturnType<typeof computePairScore>>>
}> {
  // Fetch eligible founders from Syrena
  const allFounders = (await sql`
    SELECT
      f.id, f."userId", f.industries, f."preferredLocations",
      f."fundingStage", f."chequeSizesAccepted", f.bio,
      f."companyName", f."targetRaiseAmount",
      f."websiteUrl", f."linkedinUrl",
      f."createdAt", f."updatedAt",
      u.email, u."firstName", u."lastName", u."lastLogin",
      u.status as "userStatus"
    FROM founders f
    JOIN users u ON f."userId" = u.id
    WHERE u.status IN ('APPROVED', 'PROFILE_COMPLETED')
      AND ${industry} = ANY(f.industries)
  `) as FounderWithUser[]

  // Filter out excluded founders
  const eligible = allFounders.filter((f) => !excludeFounderIds.has(f.userId))

  // Get existing intro requests to check for blocks
  const investorIds = selectedInvestors.map((i) => i.investor.id)
  const founderIds = eligible.map((f) => f.id)

  let blockedPairs = new Set<string>()
  if (investorIds.length > 0 && founderIds.length > 0) {
    const intros = await sql`
      SELECT "investorId", "founderId"
      FROM intro_requests
      WHERE "investorId" = ANY(${investorIds})
        AND "founderId" = ANY(${founderIds})
        AND status IN ('ACCEPTED', 'REJECTED')
    `
    blockedPairs = new Set(
      intros.map(
        (ir) =>
          `${ir.investorId}:${ir.founderId}`
      )
    )
  }

  // Score all investor-founder pairs
  const pairScores = new Map<
    string,
    Map<string, ReturnType<typeof computePairScore>>
  >()

  // Track aggregate score per founder (sum across all investors)
  const founderAggScores = new Map<string, number>()

  for (const inv of selectedInvestors) {
    const investorScores = new Map<
      string,
      ReturnType<typeof computePairScore>
    >()

    for (const fnd of eligible) {
      const pairKey = `${inv.investor.id}:${fnd.id}`
      if (blockedPairs.has(pairKey)) continue

      const score = computePairScore(inv.investor, fnd)
      investorScores.set(fnd.userId, score)

      const current = founderAggScores.get(fnd.userId) ?? 0
      founderAggScores.set(fnd.userId, current + score.totalScore)
    }

    pairScores.set(inv.investor.userId, investorScores)
  }

  // Select top founders by aggregate score
  const rankedFounders = eligible
    .map((f) => ({
      founder: f,
      aggScore: founderAggScores.get(f.userId) ?? 0,
    }))
    .sort((a, b) => b.aggScore - a.aggScore)
    .slice(0, POOL_DEFAULTS.MAX_FOUNDERS)

  return {
    founders: rankedFounders.map((r) => r.founder),
    pairScores,
  }
}
