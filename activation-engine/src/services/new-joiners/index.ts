import { findNewJoiners, generateMatchesForUser } from "./find-matches"
import type { NewJoinerCandidate } from "@/lib/types"

export interface NewJoinerRunResult {
  candidates: NewJoinerCandidate[]
  results: {
    userId: string
    name: string
    side: "INVESTOR" | "FOUNDER"
    matchCount: number
    matchIds: string[]
    error?: string
  }[]
  summary: {
    totalCandidates: number
    totalMatched: number
    totalFailed: number
    investorCandidates: number
    founderCandidates: number
  }
}

/**
 * Orchestrator: Find all new joiners and generate matches for each.
 *
 * Flow:
 * 1. Find users who signed up within the last 7 days and don't have matches yet
 * 2. For each new joiner, find 2-3 curated matches from existing user base
 * 3. Persist NewJoinerMatch records in sandbox DB
 * 4. Return summary for operator review
 */
export async function runNewJoinerMatching(): Promise<NewJoinerRunResult> {
  // Step 1: Find all new joiners
  const candidates = await findNewJoiners()

  if (candidates.length === 0) {
    return {
      candidates: [],
      results: [],
      summary: {
        totalCandidates: 0,
        totalMatched: 0,
        totalFailed: 0,
        investorCandidates: 0,
        founderCandidates: 0,
      },
    }
  }

  // Step 2-3: Generate matches for each candidate
  const results: NewJoinerRunResult["results"] = []

  for (const candidate of candidates) {
    try {
      const { matchCount, matchIds } =
        await generateMatchesForUser(candidate)
      results.push({
        userId: candidate.userId,
        name: candidate.name,
        side: candidate.side,
        matchCount,
        matchIds,
      })
    } catch (error) {
      results.push({
        userId: candidate.userId,
        name: candidate.name,
        side: candidate.side,
        matchCount: 0,
        matchIds: [],
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  // Step 4: Summary
  const totalMatched = results.filter((r) => r.matchCount > 0).length
  const totalFailed = results.filter((r) => r.error).length

  return {
    candidates,
    results,
    summary: {
      totalCandidates: candidates.length,
      totalMatched,
      totalFailed,
      investorCandidates: candidates.filter((c) => c.side === "INVESTOR")
        .length,
      founderCandidates: candidates.filter((c) => c.side === "FOUNDER").length,
    },
  }
}
