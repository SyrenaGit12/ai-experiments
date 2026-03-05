import db from "@/lib/db"
import { POOL_DEFAULTS } from "@/lib/constants"
import type { ScoredInvestor } from "@/lib/types"
import type { FounderWithUser } from "@/lib/syrena-types"

/**
 * Step 6: Apply fairness constraints.
 * - Max 2 concurrent active pools per investor
 * - Min 3 per side, skip pool if insufficient
 */
export async function applyFairnessConstraints(
  investors: ScoredInvestor[],
  founders: FounderWithUser[]
): Promise<{
  validInvestors: ScoredInvestor[]
  validFounders: FounderWithUser[]
  viable: boolean
  reason?: string
}> {
  // Check concurrent pool limit for investors
  const investorUserIds = investors.map((i) => i.investor.userId)
  const poolCounts = await db.poolMember.groupBy({
    by: ["userId"],
    where: {
      userId: { in: investorUserIds },
      side: "INVESTOR",
      pool: { status: { in: ["APPROVED", "ACTIVE"] } },
    },
    _count: true,
  })
  const poolCountMap = new Map(poolCounts.map((p) => [p.userId, p._count]))

  const validInvestors = investors.filter((inv) => {
    const count = poolCountMap.get(inv.investor.userId) ?? 0
    return count < POOL_DEFAULTS.MAX_CONCURRENT_POOLS_PER_INVESTOR
  })

  // Check founder uniqueness in active pools
  const founderUserIds = founders.map((f) => f.userId)
  const activeFounders = await db.poolMember.findMany({
    where: {
      userId: { in: founderUserIds },
      side: "FOUNDER",
      pool: { status: { in: ["DRAFT", "APPROVED", "ACTIVE"] } },
    },
    select: { userId: true },
  })
  const activeFounderSet = new Set(activeFounders.map((m) => m.userId))

  const validFounders = founders.filter((f) => !activeFounderSet.has(f.userId))

  // Viability check
  if (validInvestors.length < POOL_DEFAULTS.MIN_INVESTORS) {
    return {
      validInvestors,
      validFounders,
      viable: false,
      reason: `Only ${validInvestors.length} eligible investors (need ${POOL_DEFAULTS.MIN_INVESTORS})`,
    }
  }

  if (validFounders.length < POOL_DEFAULTS.MIN_FOUNDERS) {
    return {
      validInvestors,
      validFounders,
      viable: false,
      reason: `Only ${validFounders.length} eligible founders (need ${POOL_DEFAULTS.MIN_FOUNDERS})`,
    }
  }

  return { validInvestors, validFounders, viable: true }
}
