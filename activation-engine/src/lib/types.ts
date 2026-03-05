import type { Pool, PoolMember, PoolPair, MatchScore } from "@prisma/client"
import type { InvestorWithUser, FounderWithUser } from "./syrena-types"

// ─── Pool Generation ─────────────────────────────────────

export interface PoolGenerationRequest {
  industry: string
  minInvestors?: number
  maxInvestors?: number
  minFounders?: number
  maxFounders?: number
  slaHours?: number
}

export interface PoolGenerationResult {
  pool: Pool
  members: PoolMember[]
  pairs: PoolPair[]
  scores: MatchScore[]
}

// ─── Investor Scoring ────────────────────────────────────

export interface ScoredInvestor {
  investor: InvestorWithUser
  engagementScore: number
  tier: "HOT" | "WARM" | "GAP_FILL"
}

// ─── Pair Scoring ────────────────────────────────────────

export interface PairScoreBreakdown {
  industryScore: number
  locationScore: number
  stageScore: number
  chequeSizeScore: number
  engagementScore: number
  totalScore: number
}

// ─── Control Tower ───────────────────────────────────────

export interface PoolWithCounts extends Pool {
  _count: {
    members: number
    pairs: number
  }
  investorCount: number
  founderCount: number
}

export interface PoolDetailView extends Pool {
  members: PoolMember[]
  pairs: (PoolPair & { matchScore: MatchScore | null })[]
  events: { id: string; type: string; createdAt: Date; payload: unknown }[]
}
