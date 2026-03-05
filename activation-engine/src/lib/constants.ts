// ─── Scoring Weights ─────────────────────────────────────
export const SCORING_WEIGHTS = {
  INDUSTRY_OVERLAP: 50,
  LOCATION_OVERLAP: 25,
  STAGE_MATCH: 10,
  CHEQUE_SIZE: 5,
  ENGAGEMENT: 10,
} as const

// ─── Pool Defaults ───────────────────────────────────────
export const POOL_DEFAULTS = {
  MIN_INVESTORS: 3,
  MAX_INVESTORS: 6,
  MIN_FOUNDERS: 3,
  MAX_FOUNDERS: 6,
  SLA_HOURS: 48,
  MAX_CONCURRENT_POOLS_PER_INVESTOR: 2,
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
