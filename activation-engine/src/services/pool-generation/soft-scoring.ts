import { SCORING_WEIGHTS } from "@/lib/constants"
import type { InvestorWithUser, FounderWithUser } from "@/lib/syrena-types"
import type { PairScoreBreakdown } from "@/lib/types"

/**
 * Step 5: Compute soft scores for investor-founder pairs.
 * Uses Jaccard similarity for set overlaps and boolean match for others.
 */
export function computePairScore(
  investor: InvestorWithUser,
  founder: FounderWithUser
): PairScoreBreakdown {
  const industryScore = computeIndustryScore(investor, founder)
  const locationScore = computeLocationScore(investor, founder)
  const stageScore = computeStageScore(investor, founder)
  const chequeSizeScore = computeChequeSizeScore(investor, founder)
  const engagementScore = computeCombinedEngagement(investor, founder)

  const totalScore =
    industryScore + locationScore + stageScore + chequeSizeScore + engagementScore

  return {
    industryScore,
    locationScore,
    stageScore,
    chequeSizeScore,
    engagementScore,
    totalScore,
  }
}

// Jaccard similarity × weight
function computeIndustryScore(
  investor: InvestorWithUser,
  founder: FounderWithUser
): number {
  const invSet = new Set(investor.industries ?? [])
  const fndSet = new Set(founder.industries ?? [])
  if (invSet.size === 0 && fndSet.size === 0) return 0

  const intersection = [...invSet].filter((x) => fndSet.has(x)).length
  const union = new Set([...invSet, ...fndSet]).size
  const jaccard = union > 0 ? intersection / union : 0

  return jaccard * SCORING_WEIGHTS.INDUSTRY_OVERLAP
}

function computeLocationScore(
  investor: InvestorWithUser,
  founder: FounderWithUser
): number {
  const invLocs = new Set(investor.preferredLocations ?? [])
  const fndLocs = new Set(founder.preferredLocations ?? [])
  if (invLocs.size === 0 && fndLocs.size === 0) return SCORING_WEIGHTS.LOCATION_OVERLAP // Both global

  // If either has GLOBAL, full match
  if (invLocs.has("GLOBAL") || fndLocs.has("GLOBAL"))
    return SCORING_WEIGHTS.LOCATION_OVERLAP

  const intersection = [...invLocs].filter((x) => fndLocs.has(x)).length
  const union = new Set([...invLocs, ...fndLocs]).size
  const jaccard = union > 0 ? intersection / union : 0

  return jaccard * SCORING_WEIGHTS.LOCATION_OVERLAP
}

function computeStageScore(
  investor: InvestorWithUser,
  founder: FounderWithUser
): number {
  if (!founder.fundingStage || !investor.fundingStages) return 0
  const match = investor.fundingStages.includes(founder.fundingStage)
  return match ? SCORING_WEIGHTS.STAGE_MATCH : 0
}

function computeChequeSizeScore(
  investor: InvestorWithUser,
  founder: FounderWithUser
): number {
  if (
    !investor.ticketSizes ||
    investor.ticketSizes.length === 0 ||
    !founder.targetRaiseAmount
  )
    return 0

  const min = Math.min(...investor.ticketSizes)
  const max = Math.max(...investor.ticketSizes)
  const target = founder.targetRaiseAmount

  // Check if investor's ticket range could cover part of the raise
  if (target >= min && target <= max * 10) {
    return SCORING_WEIGHTS.CHEQUE_SIZE
  }
  return 0
}

function computeCombinedEngagement(
  investor: InvestorWithUser,
  founder: FounderWithUser
): number {
  let score = 0

  // Investor recency
  if (investor.lastLogin) {
    const days = Math.floor(
      (Date.now() - new Date(investor.lastLogin).getTime()) /
        (1000 * 60 * 60 * 24)
    )
    score += Math.max(0, 5 - days / 6) // 5 points if recent
  }

  // Founder recency
  if (founder.lastLogin) {
    const days = Math.floor(
      (Date.now() - new Date(founder.lastLogin).getTime()) /
        (1000 * 60 * 60 * 24)
    )
    score += Math.max(0, 5 - days / 6)
  }

  return Math.min(SCORING_WEIGHTS.ENGAGEMENT, score)
}
