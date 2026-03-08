// ─── Scoring Weights ─────────────────────────────────────
export const SCORING_WEIGHTS = {
  INDUSTRY_OVERLAP: 50,
  LOCATION_OVERLAP: 25,
  STAGE_MATCH: 10,
  CHEQUE_SIZE: 5,
  ENGAGEMENT: 10,
} as const

// ─── Pool Defaults ───────────────────────────────────────
// Soft targets — the algorithm aims for these but adjusts flexibly
export const POOL_DEFAULTS = {
  // Soft targets (what we aim for)
  TARGET_INVESTORS: 3,
  TARGET_FOUNDERS: 4,

  // Hard limits
  MIN_POOL_MEMBERS: 2,  // Absolute minimum per side to create a pool
  MAX_POOL_MEMBERS: 6,  // Hard ceiling per side

  // Legacy aliases (used in DB schema defaults)
  MIN_INVESTORS: 2,
  MAX_INVESTORS: 6,
  MIN_FOUNDERS: 2,
  MAX_FOUNDERS: 6,

  SLA_HOURS: 48,
  MAX_CONCURRENT_POOLS_PER_INVESTOR: 2,

  // Match presentation limits
  MATCHES_PER_INVESTOR: 4,  // Investors see up to 4 founders
  MATCHES_PER_FOUNDER: 3,   // Founders see up to 3 investors

  // Recency filter
  INVESTOR_LOGIN_RECENCY_DAYS: 14,
} as const

// ─── New Joiner Defaults ────────────────────────────────
export const NEW_JOINER_DEFAULTS = {
  RECENCY_DAYS: 7,            // "new joiner" = signed up within 7 days
  MATCHES_FOR_INVESTOR: 3,    // New investor joiners see 3 founders
  MATCHES_FOR_FOUNDER: 2,     // New founder joiners see 2 investors
} as const

// ─── Investor Tier Thresholds (percentile) ───────────────
export const TIER_THRESHOLDS = {
  HOT: 70,
  WARM: 30,
} as const

// ─── Activation Thresholds ──────────────────────────────
export const ACTIVATION_THRESHOLDS = {
  STRONG_ACTIVATED_INTROS: 3,
  AT_RISK_INACTIVE_DAYS: 30,
} as const

// ─── Syrena Enums (mirror from Syrena Prisma schema) ────
// These must match the actual values in the Syrena database

export const SYRENA_INDUSTRIES = [
  "AI_MACHINE_LEARNING",
  "FINTECH",
  "HEALTH_TECH",
  "ED_TECH",
  "E_COMMERCE",
  "SAAS",
  "CLEAN_TECH",
  "BIOTECH",
  "REAL_ESTATE_TECH",
  "FOOD_TECH",
  "TRAVEL_TECH",
  "AGRI_TECH",
  "FASHION_TECH",
  "MEDIA_ENTERTAINMENT",
  "CYBERSECURITY",
  "BLOCKCHAIN_CRYPTO",
  "ROBOTICS",
  "SPACE_TECH",
  "SOCIAL_IMPACT",
  "GAMING",
  "IOT",
  "SUPPLY_CHAIN_LOGISTICS",
  "LEGAL_TECH",
  "INSURANCE_TECH",
  "HR_TECH",
  "CONSTRUCTION_TECH",
  "AUTOMOTIVE_TECH",
  "TELECOM",
] as const

export const SYRENA_FUNDING_STAGES = [
  "PRE_SEED",
  "SEED",
  "SERIES_A",
  "SERIES_B",
  "SERIES_C",
  "GROWTH",
  "PRE_IPO",
] as const

export const SYRENA_USER_STATUSES = [
  "APPROVED",
  "PROFILE_COMPLETED",
] as const

// ─── Activation UI Constants ────────────────────────────
// Single source of truth — imported by Dashboard, Pipeline, Detail pages

export const STAGES = [
  "NEW",
  "S1_MATCHES_SENT",
  "S2_USER_RESPONDED",
  "S3_COUNTERPARTY_ASKED",
  "S3_FEEDBACK_RECEIVED",
  "ACTIVATED",
  "STALLED",
  "DECLINED",
] as const

/** Active pipeline stages (excludes terminal states) — used for progress bars */
export const STAGE_ORDER = [
  "NEW",
  "S1_MATCHES_SENT",
  "S2_USER_RESPONDED",
  "S3_COUNTERPARTY_ASKED",
  "S3_FEEDBACK_RECEIVED",
  "ACTIVATED",
] as const

/** Short labels for badges & compact UI */
export const STAGE_LABELS: Record<string, string> = {
  NEW: "New",
  S1_MATCHES_SENT: "S1: Matches Sent",
  S2_USER_RESPONDED: "S2: Responded",
  S3_COUNTERPARTY_ASKED: "S3: CP Asked",
  S3_FEEDBACK_RECEIVED: "S3: Feedback In",
  ACTIVATED: "Activated ✓",
  STALLED: "Stalled",
  DECLINED: "Declined",
}

/** Longer labels for detail page contexts */
export const STAGE_LABELS_FULL: Record<string, string> = {
  NEW: "New",
  S1_MATCHES_SENT: "S1: Matches Sent",
  S2_USER_RESPONDED: "S2: User Responded",
  S3_COUNTERPARTY_ASKED: "S3: Counterparty Asked",
  S3_FEEDBACK_RECEIVED: "S3: Feedback Received",
  ACTIVATED: "Activated ✓",
  STALLED: "Stalled",
  DECLINED: "Declined",
}

/** Compound bg+text classes for stage badges */
export const STAGE_BADGE_COLORS: Record<string, string> = {
  NEW: "bg-gray-700 text-gray-300",
  S1_MATCHES_SENT: "bg-blue-900/50 text-blue-300",
  S2_USER_RESPONDED: "bg-purple-900/50 text-purple-300",
  S3_COUNTERPARTY_ASKED: "bg-amber-900/50 text-amber-300",
  S3_FEEDBACK_RECEIVED: "bg-cyan-900/50 text-cyan-300",
  ACTIVATED: "bg-green-900/50 text-green-300",
  STALLED: "bg-red-900/50 text-red-300",
  DECLINED: "bg-gray-800 text-gray-500",
}

/** Simple bg classes for funnel bars (dashboard) */
export const STAGE_BAR_COLORS: Record<string, string> = {
  NEW: "bg-gray-700",
  S1_MATCHES_SENT: "bg-blue-600",
  S2_USER_RESPONDED: "bg-purple-600",
  S3_COUNTERPARTY_ASKED: "bg-amber-600",
  S3_FEEDBACK_RECEIVED: "bg-cyan-600",
  ACTIVATED: "bg-green-600",
  STALLED: "bg-red-600",
  DECLINED: "bg-gray-600",
}

export const TEAM_MEMBERS = ["Saksham", "Greg", "Silvio", "Rich", "Josh", "Aziz"] as const

export const WEEKLY_TARGETS = { founders: 40, investors: 20 } as const
