import db from "@/lib/db"
import { sql } from "@/lib/syrena"
import { NEW_JOINER_DEFAULTS } from "@/lib/constants"
import { computePairScore } from "@/services/pool-generation/soft-scoring"
import type { InvestorWithUser, FounderWithUser } from "@/lib/syrena-types"
import type { NewJoinerCandidate } from "@/lib/types"
import { isTestMode } from "@/lib/email-test-mode"

/**
 * Find new joiners: users who signed up within RECENCY_DAYS (7).
 * Returns candidates grouped by side, excluding those already matched.
 */
export async function findNewJoiners(): Promise<NewJoinerCandidate[]> {
  const recencyDays = NEW_JOINER_DEFAULTS.RECENCY_DAYS
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - recencyDays)
  const cutoffIso = cutoffDate.toISOString()

  // Find recently joined users from Syrena
  const recentUsers = await sql`
    SELECT u.id, u.role, u.email, u."firstName", u."lastName", u."createdAt"
    FROM users u
    WHERE u.status IN ('APPROVED', 'PROFILE_COMPLETED')
      AND u.role IN ('FOUNDER', 'INVESTOR')
      AND u."createdAt" >= ${cutoffIso}::timestamp
  `

  // Get users who already have NewJoinerMatch records
  const existingMatches = await db.newJoinerMatch.findMany({
    select: { userId: true },
    distinct: ["userId"],
  })
  const alreadyMatchedSet = new Set(existingMatches.map((m) => m.userId))

  // Filter out already-matched users
  const candidates: NewJoinerCandidate[] = recentUsers
    .filter((u) => !alreadyMatchedSet.has(u.id))
    .map((u) => ({
      userId: u.id,
      side: u.role === "INVESTOR" ? ("INVESTOR" as const) : ("FOUNDER" as const),
      name: [u.firstName, u.lastName].filter(Boolean).join(" ") || "Unknown",
      email: u.email,
      industries: [], // Will be populated from investor/founder profiles
      signedUpAt: new Date(u.createdAt),
    }))

  return candidates
}

/**
 * Find the best matches for a new investor joiner.
 * Looks for existing founders (preferably ACTIVATED/STRONG_ACTIVATED) and scores them.
 */
export async function findMatchesForInvestor(
  investorUserId: string
): Promise<
  {
    founder: FounderWithUser
    score: number
    breakdown: ReturnType<typeof computePairScore>
  }[]
> {
  // Fetch the new investor's profile from Syrena
  const [investorProfile] = (await sql`
    SELECT
      i.id, i."userId", i."investorType", i.industries,
      i."fundingStages", i."preferredLocations", i."ticketSizes",
      i."investmentActivity", i.bio, i."linkedinUrl", i."jobTitleLevel",
      i."createdAt", i."updatedAt",
      u.email, u."firstName", u."lastName", u."lastLogin",
      u.status as "userStatus"
    FROM investors i
    JOIN users u ON i."userId" = u.id
    WHERE i."userId" = ${investorUserId}
  `) as InvestorWithUser[]

  if (!investorProfile) {
    throw new Error(`Investor profile not found for userId: ${investorUserId}`)
  }

  // Fetch eligible founders — prefer those who are ACTIVATED or STRONG_ACTIVATED
  const activatedStatuses = await db.userActivationStatus.findMany({
    where: {
      side: "FOUNDER",
      status: { in: ["ACTIVATED", "STRONG_ACTIVATED"] },
    },
    select: { userId: true },
  })
  const activatedFounderIds = new Set(activatedStatuses.map((s) => s.userId))

  // Get industries from investor to filter founders
  const investorIndustries = investorProfile.industries ?? []
  if (investorIndustries.length === 0) {
    return []
  }

  // Fetch all founders in overlapping industries
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
      AND f.industries && ${investorIndustries}::text[]
  `) as FounderWithUser[]

  // Check for existing intro requests to exclude blocked pairs
  const founderIds = allFounders.map((f) => f.id)
  let blockedPairs = new Set<string>()
  if (founderIds.length > 0) {
    const intros = await sql`
      SELECT "investorId", "founderId"
      FROM intro_requests
      WHERE "investorId" = ${investorProfile.id}
        AND "founderId" = ANY(${founderIds})
        AND status IN ('ACCEPTED', 'REJECTED')
    `
    blockedPairs = new Set(
      intros.map((ir) => `${ir.investorId}:${ir.founderId}`)
    )
  }

  // Score each founder
  const scored = allFounders
    .filter((f) => {
      const pairKey = `${investorProfile.id}:${f.id}`
      return !blockedPairs.has(pairKey)
    })
    .map((founder) => {
      const breakdown = computePairScore(investorProfile, founder)
      // Bonus for activated founders (proven responders)
      const activationBonus = activatedFounderIds.has(founder.userId) ? 10 : 0
      return {
        founder,
        score: breakdown.totalScore + activationBonus,
        breakdown,
      }
    })
    .sort((a, b) => b.score - a.score)

  // Return top N matches
  return scored.slice(0, NEW_JOINER_DEFAULTS.MATCHES_FOR_INVESTOR)
}

/**
 * Find the best matches for a new founder joiner.
 * Looks for existing investors (preferably ACTIVATED/STRONG_ACTIVATED) and scores them.
 */
export async function findMatchesForFounder(
  founderUserId: string
): Promise<
  {
    investor: InvestorWithUser
    score: number
    breakdown: ReturnType<typeof computePairScore>
  }[]
> {
  // Fetch the new founder's profile from Syrena
  const [founderProfile] = (await sql`
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
    WHERE f."userId" = ${founderUserId}
  `) as FounderWithUser[]

  if (!founderProfile) {
    throw new Error(`Founder profile not found for userId: ${founderUserId}`)
  }

  // Fetch eligible investors — prefer those who are ACTIVATED or STRONG_ACTIVATED
  const activatedStatuses = await db.userActivationStatus.findMany({
    where: {
      side: "INVESTOR",
      status: { in: ["ACTIVATED", "STRONG_ACTIVATED"] },
    },
    select: { userId: true },
  })
  const activatedInvestorIds = new Set(activatedStatuses.map((s) => s.userId))

  // Get industries from founder to filter investors
  const founderIndustries = founderProfile.industries ?? []
  if (founderIndustries.length === 0) {
    return []
  }

  // Fetch all investors in overlapping industries
  const allInvestors = (await sql`
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
      AND i.industries && ${founderIndustries}::text[]
  `) as InvestorWithUser[]

  // Check for existing intro requests to exclude blocked pairs
  const investorIds = allInvestors.map((i) => i.id)
  let blockedPairs = new Set<string>()
  if (investorIds.length > 0) {
    const intros = await sql`
      SELECT "investorId", "founderId"
      FROM intro_requests
      WHERE "founderId" = ${founderProfile.id}
        AND "investorId" = ANY(${investorIds})
        AND status IN ('ACCEPTED', 'REJECTED')
    `
    blockedPairs = new Set(
      intros.map((ir) => `${ir.investorId}:${ir.founderId}`)
    )
  }

  // Score each investor
  const scored = allInvestors
    .filter((inv) => {
      const pairKey = `${inv.id}:${founderProfile.id}`
      return !blockedPairs.has(pairKey)
    })
    .map((investor) => {
      const breakdown = computePairScore(investor, founderProfile)
      // Bonus for activated investors (proven responders)
      const activationBonus = activatedInvestorIds.has(investor.userId) ? 10 : 0
      return {
        investor,
        score: breakdown.totalScore + activationBonus,
        breakdown,
      }
    })
    .sort((a, b) => b.score - a.score)

  // Return top N matches
  return scored.slice(0, NEW_JOINER_DEFAULTS.MATCHES_FOR_FOUNDER)
}

/**
 * Generate matches for a single new joiner and persist to sandbox DB.
 */
export async function generateMatchesForUser(
  candidate: NewJoinerCandidate
): Promise<{ matchCount: number; matchIds: string[] }> {
  if (candidate.side === "INVESTOR") {
    const matches = await findMatchesForInvestor(candidate.userId)
    const records = await Promise.all(
      matches.map((m) =>
        db.newJoinerMatch.create({
          data: {
            userId: candidate.userId,
            side: "INVESTOR",
            matchUserId: m.founder.userId,
            userName: candidate.name,
            userEmail: candidate.email,
            matchName: [m.founder.firstName, m.founder.lastName]
              .filter(Boolean)
              .join(" "),
            matchEmail: m.founder.email,
            score: m.score,
            isTestMode: isTestMode(),
          },
        })
      )
    )
    return { matchCount: records.length, matchIds: records.map((r) => r.id) }
  } else {
    const matches = await findMatchesForFounder(candidate.userId)
    const records = await Promise.all(
      matches.map((m) =>
        db.newJoinerMatch.create({
          data: {
            userId: candidate.userId,
            side: "FOUNDER",
            matchUserId: m.investor.userId,
            userName: candidate.name,
            userEmail: candidate.email,
            matchName: [m.investor.firstName, m.investor.lastName]
              .filter(Boolean)
              .join(" "),
            matchEmail: m.investor.email,
            score: m.score,
            isTestMode: isTestMode(),
          },
        })
      )
    )
    return { matchCount: records.length, matchIds: records.map((r) => r.id) }
  }
}
