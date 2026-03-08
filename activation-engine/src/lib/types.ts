import type {
  Pool,
  PoolMember,
  PoolPair,
  MatchScore,
  PersonalizationLine,
  NewJoinerMatch,
} from "@prisma/client"
import type { InvestorWithUser, FounderWithUser } from "./syrena-types"

// ─── Pool Generation ─────────────────────────────────────

export interface PoolGenerationRequest {
  industry: string
  minInvestors?: number
  maxInvestors?: number
  minFounders?: number
  maxFounders?: number
  slaHours?: number
  ownerId?: string
  ownerName?: string
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

// ─── Personalization ─────────────────────────────────────

export interface PersonalizationRequest {
  poolId?: string
  newJoinerMatchId?: string
  investorProfile: {
    name: string
    bio?: string
    industries: string[]
    fundingStages: string[]
    investorType?: string
  }
  founderProfile: {
    name: string
    bio?: string
    companyName?: string
    industries: string[]
    fundingStage?: string
  }
}

export interface PersonalizationResult {
  investorLine: string
  founderLine: string
}

// ─── Cross-Match ─────────────────────────────────────────

export type CrossMatchOutcome =
  | "MUTUAL_YES"
  | "INVESTOR_ONLY"
  | "FOUNDER_ONLY"
  | "NO_MATCH"
  | "PENDING"

export interface CrossMatchResult {
  pairId: string
  investorId: string
  founderId: string
  investorSelected: boolean
  founderSelected: boolean
  outcome: CrossMatchOutcome
}

// ─── New Joiners ─────────────────────────────────────────

export interface NewJoinerCandidate {
  userId: string
  side: "INVESTOR" | "FOUNDER"
  name: string
  email: string
  industries: string[]
  signedUpAt: Date
}

// ─── Activation Records (Client-side) ────────────────

export interface ActivationMatchClient {
  id: string
  matchName: string
  matchCompany: string | null
  selected: boolean
  counterpartyResponse: string | null
  introSent: boolean
}

export interface ActivationRecordClient {
  id: string
  syrenaUserId: string
  side: "INVESTOR" | "FOUNDER"
  name: string
  email: string
  company: string | null
  industry: string
  fundingStage: string | null
  stage: string
  owner: string | null
  matchesSentAt: string | null
  respondedAt: string | null
  counterpartyAskedAt: string | null
  counterpartyRespondedAt: string | null
  outcome: string | null
  activatedAt: string | null
  notes: string | null
  slaDeadline: string | null
  createdAt: string
  updatedAt: string
  matches: ActivationMatchClient[]
}

// ─── API Response Types ─────────────────────────────

export interface ActivationListResponse {
  records: ActivationRecordClient[]
  total: number
  limit: number
  offset: number
  stageCounts?: Record<string, number>
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
  pairs: (PoolPair & {
    matchScore: MatchScore | null
    personalizationLines: PersonalizationLine[]
  })[]
  events: { id: string; type: string; createdAt: Date; payload: unknown }[]
}
