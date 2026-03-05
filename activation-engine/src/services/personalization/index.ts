import OpenAI from "openai"
import db from "@/lib/db"
import { sql } from "@/lib/syrena"
import type { InvestorWithUser, FounderWithUser } from "@/lib/syrena-types"
import type { PersonalizationRequest } from "@/lib/types"
import { generateLinesForPairs } from "./generate-lines"

function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY is not set. Add it to your environment to enable AI personalization."
    )
  }
  return new OpenAI({ apiKey })
}

// ─── Pool Pair Personalization ───────────────────────────

export interface PoolPersonalizationResult {
  poolId: string
  totalPairs: number
  generated: number
  failed: number
  skipped: number
  errors: { pairId: string; error: string }[]
}

/**
 * Generate personalization lines for all presented pairs in a pool.
 *
 * Flow:
 * 1. Fetch all pool pairs where presentedToInvestor=true OR presentedToFounder=true
 * 2. Skip pairs that already have personalization lines
 * 3. Fetch investor + founder profiles from Syrena
 * 4. Call LLM in parallel for all pairs
 * 5. Persist PersonalizationLine records
 */
export async function generatePersonalizationForPool(
  poolId: string
): Promise<PoolPersonalizationResult> {
  const client = getOpenAIClient()

  // 1. Get all presented pairs
  const pairs = await db.poolPair.findMany({
    where: {
      poolId,
      OR: [
        { presentedToInvestor: true },
        { presentedToFounder: true },
      ],
    },
    include: {
      personalizationLines: true,
    },
  })

  if (pairs.length === 0) {
    return {
      poolId,
      totalPairs: 0,
      generated: 0,
      failed: 0,
      skipped: 0,
      errors: [],
    }
  }

  // 2. Filter out pairs that already have both lines
  const pairsNeedingLines = pairs.filter((p) => {
    const hasInvestorLine = p.personalizationLines.some(
      (l) => l.side === "INVESTOR"
    )
    const hasFounderLine = p.personalizationLines.some(
      (l) => l.side === "FOUNDER"
    )
    return !hasInvestorLine || !hasFounderLine
  })

  const skipped = pairs.length - pairsNeedingLines.length

  if (pairsNeedingLines.length === 0) {
    return {
      poolId,
      totalPairs: pairs.length,
      generated: 0,
      failed: 0,
      skipped,
      errors: [],
    }
  }

  // 3. Fetch all unique investor + founder profiles from Syrena
  const investorIds = [...new Set(pairsNeedingLines.map((p) => p.investorId))]
  const founderIds = [...new Set(pairsNeedingLines.map((p) => p.founderId))]

  const [investorProfiles, founderProfiles] = await Promise.all([
    fetchInvestorProfiles(investorIds),
    fetchFounderProfiles(founderIds),
  ])

  // 4. Build requests
  const requests: (PersonalizationRequest & { pairId: string })[] = []

  for (const pair of pairsNeedingLines) {
    const investor = investorProfiles.get(pair.investorId)
    const founder = founderProfiles.get(pair.founderId)

    if (!investor || !founder) {
      console.warn(
        `[Personalization] Skipping pair ${pair.id}: missing profile (investor=${!!investor}, founder=${!!founder})`
      )
      continue
    }

    requests.push({
      pairId: pair.id,
      poolId,
      investorProfile: {
        name: [investor.firstName, investor.lastName]
          .filter(Boolean)
          .join(" "),
        bio: investor.bio ?? undefined,
        industries: (investor.industries ?? []) as string[],
        fundingStages: (investor.fundingStages ?? []) as string[],
        investorType: (investor.investorType as string) ?? undefined,
      },
      founderProfile: {
        name: [founder.firstName, founder.lastName]
          .filter(Boolean)
          .join(" "),
        bio: founder.bio ?? undefined,
        companyName: founder.companyName ?? undefined,
        industries: (founder.industries ?? []) as string[],
        fundingStage: (founder.fundingStage as string) ?? undefined,
      },
    })
  }

  // 5. Generate in parallel
  const results = await generateLinesForPairs(client, requests)

  // 6. Persist successful results
  let generated = 0
  const errors: { pairId: string; error: string }[] = []

  for (const result of results) {
    if (result.error || !result.result) {
      errors.push({
        pairId: result.pairId,
        error: result.error ?? "No result returned",
      })
      continue
    }

    // Find which pair this is and determine which lines to create
    const pair = pairsNeedingLines.find((p) => p.id === result.pairId)
    if (!pair) continue

    const linesToCreate: {
      poolPairId: string
      side: "INVESTOR" | "FOUNDER"
      line: string
    }[] = []

    const hasInvestorLine = pair.personalizationLines.some(
      (l) => l.side === "INVESTOR"
    )
    const hasFounderLine = pair.personalizationLines.some(
      (l) => l.side === "FOUNDER"
    )

    if (!hasInvestorLine && pair.presentedToInvestor) {
      linesToCreate.push({
        poolPairId: pair.id,
        side: "INVESTOR",
        line: result.result.investorLine,
      })
    }

    if (!hasFounderLine && pair.presentedToFounder) {
      linesToCreate.push({
        poolPairId: pair.id,
        side: "FOUNDER",
        line: result.result.founderLine,
      })
    }

    if (linesToCreate.length > 0) {
      await db.personalizationLine.createMany({ data: linesToCreate })
      generated++
    }
  }

  return {
    poolId,
    totalPairs: pairs.length,
    generated,
    failed: errors.length,
    skipped,
    errors,
  }
}

// ─── New Joiner Personalization ──────────────────────────

export interface NewJoinerPersonalizationResult {
  totalMatches: number
  generated: number
  failed: number
  skipped: number
  errors: { matchId: string; error: string }[]
}

/**
 * Generate "why relevant" lines for new joiner matches.
 * Updates the whyRelevant field on NewJoinerMatch records.
 */
export async function generatePersonalizationForNewJoiners(
  matchIds?: string[]
): Promise<NewJoinerPersonalizationResult> {
  const client = getOpenAIClient()

  // Fetch matches (optionally filtered by IDs)
  const where = matchIds
    ? { id: { in: matchIds }, whyRelevant: null }
    : { whyRelevant: null }

  const matches = await db.newJoinerMatch.findMany({ where })

  if (matches.length === 0) {
    return {
      totalMatches: 0,
      generated: 0,
      failed: 0,
      skipped: 0,
      errors: [],
    }
  }

  // Fetch all unique user profiles from Syrena
  const allUserIds = [
    ...new Set([
      ...matches.map((m) => m.userId),
      ...matches.map((m) => m.matchUserId),
    ]),
  ]

  // We need to determine who is investor vs founder
  const investorMatches = matches.filter((m) => m.side === "INVESTOR")
  const founderMatches = matches.filter((m) => m.side === "FOUNDER")

  // For INVESTOR new joiners: userId = investor, matchUserId = founder
  // For FOUNDER new joiners: userId = founder, matchUserId = investor
  const investorUserIds = [
    ...new Set([
      ...investorMatches.map((m) => m.userId),
      ...founderMatches.map((m) => m.matchUserId),
    ]),
  ]
  const founderUserIds = [
    ...new Set([
      ...investorMatches.map((m) => m.matchUserId),
      ...founderMatches.map((m) => m.userId),
    ]),
  ]

  const [investorProfiles, founderProfiles] = await Promise.all([
    fetchInvestorProfiles(investorUserIds),
    fetchFounderProfiles(founderUserIds),
  ])

  // Build requests — for new joiners we generate a single line (the one the joiner sees)
  const requests: (PersonalizationRequest & { pairId: string })[] = []

  for (const match of matches) {
    let investorUserId: string
    let founderUserId: string

    if (match.side === "INVESTOR") {
      investorUserId = match.userId
      founderUserId = match.matchUserId
    } else {
      investorUserId = match.matchUserId
      founderUserId = match.userId
    }

    const investor = investorProfiles.get(investorUserId)
    const founder = founderProfiles.get(founderUserId)

    if (!investor || !founder) {
      console.warn(
        `[Personalization] Skipping new joiner match ${match.id}: missing profile`
      )
      continue
    }

    requests.push({
      pairId: match.id, // Reuse pairId field for matchId
      newJoinerMatchId: match.id,
      investorProfile: {
        name: [investor.firstName, investor.lastName]
          .filter(Boolean)
          .join(" "),
        bio: investor.bio ?? undefined,
        industries: (investor.industries ?? []) as string[],
        fundingStages: (investor.fundingStages ?? []) as string[],
        investorType: (investor.investorType as string) ?? undefined,
      },
      founderProfile: {
        name: [founder.firstName, founder.lastName]
          .filter(Boolean)
          .join(" "),
        bio: founder.bio ?? undefined,
        companyName: founder.companyName ?? undefined,
        industries: (founder.industries ?? []) as string[],
        fundingStage: (founder.fundingStage as string) ?? undefined,
      },
    })
  }

  // Generate in parallel
  const results = await generateLinesForPairs(client, requests)

  // Persist — for new joiners, pick the line that matches the joiner's perspective
  let generated = 0
  const errors: { matchId: string; error: string }[] = []

  for (const result of results) {
    if (result.error || !result.result) {
      errors.push({
        matchId: result.pairId,
        error: result.error ?? "No result returned",
      })
      continue
    }

    const match = matches.find((m) => m.id === result.pairId)
    if (!match) continue

    // The joiner sees the line written FOR them:
    // INVESTOR joiner → investorLine (tells them about the founder)
    // FOUNDER joiner → founderLine (tells them about the investor)
    const line =
      match.side === "INVESTOR"
        ? result.result.investorLine
        : result.result.founderLine

    await db.newJoinerMatch.update({
      where: { id: match.id },
      data: { whyRelevant: line },
    })
    generated++
  }

  return {
    totalMatches: matches.length,
    generated,
    failed: errors.length,
    skipped: 0,
    errors,
  }
}

// ─── Syrena Profile Fetchers ─────────────────────────────

async function fetchInvestorProfiles(
  userIds: string[]
): Promise<Map<string, InvestorWithUser>> {
  if (userIds.length === 0) return new Map()

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
    WHERE i."userId" = ANY(${userIds})
  `) as InvestorWithUser[]

  const map = new Map<string, InvestorWithUser>()
  for (const inv of investors) {
    map.set(inv.userId, inv)
  }
  return map
}

async function fetchFounderProfiles(
  userIds: string[]
): Promise<Map<string, FounderWithUser>> {
  if (userIds.length === 0) return new Map()

  const founders = (await sql`
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
    WHERE f."userId" = ANY(${userIds})
  `) as FounderWithUser[]

  const map = new Map<string, FounderWithUser>()
  for (const fou of founders) {
    map.set(fou.userId, fou)
  }
  return map
}
