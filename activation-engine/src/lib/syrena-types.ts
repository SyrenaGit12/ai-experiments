/**
 * TypeScript types mirroring the Syrena Prisma schema.
 * These provide type safety for raw SQL queries via @neondatabase/serverless.
 * Keep in sync with New_Syrena's prisma/schema.prisma.
 */

// ─── Enums ───────────────────────────────────────────────

export type UserRole = "FOUNDER" | "INVESTOR" | "SERVICE_PROVIDER" | "ADMIN"
export type UserStatus =
  | "APPROVED"
  | "PROFILE_COMPLETED"
  | "WAITLISTED"
  | "REJECTED"
  | "SUSPENDED"
  | "DEACTIVATED"

export type InvestorType =
  | "ANGEL"
  | "VC"
  | "FAMILY_OFFICE"
  | "CORPORATE_VC"
  | "ACCELERATOR"
  | "SYNDICATE"
  | "PE"
  | "OTHER"

export type InvestmentActivity = "ACTIVE" | "OPEN" | "INACTIVE"

export type FundingStage =
  | "PRE_SEED"
  | "SEED"
  | "SERIES_A"
  | "SERIES_B"
  | "SERIES_C"
  | "GROWTH"
  | "PRE_IPO"

export type Industries =
  | "AI_MACHINE_LEARNING"
  | "FINTECH"
  | "HEALTH_TECH"
  | "ED_TECH"
  | "E_COMMERCE"
  | "SAAS"
  | "CLEAN_TECH"
  | "BIOTECH"
  | "REAL_ESTATE_TECH"
  | "FOOD_TECH"
  | "TRAVEL_TECH"
  | "AGRI_TECH"
  | "FASHION_TECH"
  | "MEDIA_ENTERTAINMENT"
  | "CYBERSECURITY"
  | "BLOCKCHAIN_CRYPTO"
  | "ROBOTICS"
  | "SPACE_TECH"
  | "SOCIAL_IMPACT"
  | "GAMING"
  | "IOT"
  | "SUPPLY_CHAIN_LOGISTICS"
  | "LEGAL_TECH"
  | "INSURANCE_TECH"
  | "HR_TECH"
  | "CONSTRUCTION_TECH"
  | "AUTOMOTIVE_TECH"
  | "TELECOM"

export type ChequeSize =
  | "UNDER_50K"
  | "FROM_50K_TO_100K"
  | "FROM_100K_TO_250K"
  | "FROM_250K_TO_500K"
  | "FROM_500K_TO_1M"
  | "FROM_1M_TO_5M"
  | "OVER_5M"

export type PreferredLocation =
  | "UK"
  | "US"
  | "EUROPE"
  | "MIDDLE_EAST"
  | "AFRICA"
  | "ASIA"
  | "SOUTH_AMERICA"
  | "AUSTRALIA"
  | "CANADA"
  | "INDIA"
  | "SOUTH_EAST_ASIA"
  | "GLOBAL"

export type IntroRequestStatus =
  | "PENDING"
  | "ACCEPTED"
  | "REJECTED"
  | "EXPIRED"
  | "CIRCLE_BACK"
  | "REFUNDED"

export type JobTitle =
  | "C_LEVEL"
  | "VP"
  | "DIRECTOR"
  | "PARTNER"
  | "PRINCIPAL"
  | "ASSOCIATE"
  | "ANALYST"
  | "OTHER"

// ─── Table Row Types ─────────────────────────────────────

export interface SyrenaUser {
  id: string
  email: string
  firstName: string | null
  lastName: string | null
  role: UserRole
  status: UserStatus
  lastLogin: Date | null
  isSubscribedToEmails: boolean
  isSubscribedToWhatsapp: boolean
  createdAt: Date
  updatedAt: Date
}

export interface SyrenaFounder {
  id: string
  userId: string
  industries: Industries[]
  preferredLocations: PreferredLocation[]
  fundingStage: FundingStage | null
  chequeSizesAccepted: ChequeSize[]
  bio: string | null
  companyName: string | null
  revenue: string | null
  targetRaiseAmount: number | null
  websiteUrl: string | null
  linkedinUrl: string | null
  pitchDeck: string | null
  createdAt: Date
  updatedAt: Date
}

export interface SyrenaInvestor {
  id: string
  userId: string
  investorType: InvestorType | null
  industries: Industries[]
  fundingStages: FundingStage[]
  preferredLocations: PreferredLocation[]
  ticketSizes: number[]
  investmentActivity: InvestmentActivity | null
  bio: string | null
  linkedinUrl: string | null
  jobTitleLevel: JobTitle | null
  createdAt: Date
  updatedAt: Date
}

export interface SyrenaIntroRequest {
  id: string
  founderId: string
  investorId: string
  status: IntroRequestStatus
  createdAt: Date
  updatedAt: Date
}

// ─── Join Types (commonly used in queries) ───────────────

export interface InvestorWithUser extends SyrenaInvestor {
  email: string
  firstName: string | null
  lastName: string | null
  lastLogin: Date | null
  userStatus: UserStatus
}

export interface FounderWithUser extends SyrenaFounder {
  email: string
  firstName: string | null
  lastName: string | null
  lastLogin: Date | null
  userStatus: UserStatus
}
