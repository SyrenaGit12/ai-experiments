import db from "@/lib/db"
import { sql } from "@/lib/syrena"
import { TIER_THRESHOLDS, POOL_DEFAULTS } from "@/lib/constants"
import type { InvestorWithUser } from "@/lib/syrena-types"
import type { ScoredInvestor } from "@/lib/types"
import type { InvestorTier } from "@prisma/client"

/**
 * Step 2: Score and tier investors for a target industry.
 * Fetches unactivated investors from Syrena, scores by engagement,
 * and assigns HOT/WARM/GAP_FILL tiers.
 */
export async function scoreInvestors(
  industry: string
): Promise<ScoredInvestor[]> {
  // Get investors who are in this industry and unactivated
  const activatedUserIds = await db.userActivationStatus.findMany({
    where: {
      side: "INVESTOR",
      status: { notIn: ["UNACTIVATED"] },
    },
    select: { userId: true },
  })
  const activatedSet = new Set(activatedUserIds.map((u) => u.userId))

  // Get investors with active pool memberships (to exclude)
  const activePoolMembers = await db.poolMember.findMany({
    where: {
      side: "INVESTOR",
      pool: { status: { in: ["DRAFT", "APPROVED", "ACTIVE"] } },
    },
    select: { userId: true },
  })
  const inPoolSet = new Set(activePoolMembers.map((m) => m.userId))

  // Count concurrent active pools per investor
  const poolCounts = await db.poolMember.groupBy({
    by: ["userId"],
    where: {
      side: "INVESTOR",
      pool: { status: { in: ["APPROVED", "ACTIVE"] } },
    },
    _count: true,
  })
  const poolCountMap = new Map(
    poolCounts.map((p) => [p.userId, p._count])
  )

  // Query Syrena for investors in target industry
  const investors = (await sql`
    SELECT
      i.id, i."userId", i."investorType", i.industries,
      i."fundingStages", i."preferredLocations", i."ticketSizes",
      i."investmentActivity", i.bio, i."linkedinUrl", i."jobTitleLevel",
      i."createdAt", i."updatedAt",
      u.email, u."firstName", u."lastName", u."lastLogin",
      u.status as "userStatus"
    FROM investors i
    JOIN users u ON i."userId" = u.id
    WHERE u.status IN ('APPROVED', 'PROFILE_COMPLETED')
      AND ${industry} = ANY(i.industries)
  `) as InvestorWithUser[]

  // Filter to unactivated, not already in pool, under concurrent pool limit
  const eligible = investors.filter((inv) => {
    if (activatedSet.has(inv.userId)) return false
    if (inPoolSet.has(inv.userId)) return false
    const concurrentPools = poolCountMap.get(inv.userId) ?? 0
    if (concurrentPools >= POOL_DEFAULTS.MAX_CONCURRENT_POOLS_PER_INVESTOR)
      return false
    return true
  })

  // Score each investor by engagement
  const scored: ScoredInvestor[] = eligible.map((inv) => ({
    investor: inv,
    engagementScore: computeEngagementScore(inv),
    tier: "GAP_FILL" as InvestorTier,
  }))

  // Sort by engagement score descending
  scored.sort((a, b) => b.engagementScore - a.engagementScore)

  // Assign tiers by percentile
  if (scored.length > 0) {
    const hotCutoff = Math.ceil(scored.length * (1 - TIER_THRESHOLDS.HOT / 100))
    const warmCutoff = Math.ceil(
      scored.length * (1 - TIER_THRESHOLDS.WARM / 100)
    )

    scored.forEach((s, i) => {
      if (i < hotCutoff) s.tier = "HOT"
      else if (i < warmCutoff) s.tier = "WARM"
      else s.tier = "GAP_FILL"
    })
  }

  return scored
}

function computeEngagementScore(inv: InvestorWithUser): number {
  let score = 0

  // Recency: days since last login (max 30 points)
  if (inv.lastLogin) {
    const daysSince = Math.floor(
      (Date.now() - new Date(inv.lastLogin).getTime()) / (1000 * 60 * 60 * 24)
    )
    score += Math.max(0, 30 - daysSince) // 30 points if logged in today, 0 if 30+ days ago
  }

  // Profile completeness (max 30 points)
  if (inv.bio) score += 10
  if (inv.linkedinUrl) score += 10
  if (inv.investorType) score += 5
  if (inv.fundingStages && inv.fundingStages.length > 0) score += 5

  // Investment activity (max 20 points)
  if (inv.investmentActivity === "ACTIVE") score += 20
  else if (inv.investmentActivity === "OPEN") score += 10

  // Industry breadth (max 20 points)
  if (inv.industries) {
    score += Math.min(20, inv.industries.length * 4)
  }

  return score
}
