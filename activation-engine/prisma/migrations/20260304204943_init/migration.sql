-- CreateEnum
CREATE TYPE "PoolStatus" AS ENUM ('DRAFT', 'APPROVED', 'ACTIVE', 'CLOSED');

-- CreateEnum
CREATE TYPE "PoolMemberSide" AS ENUM ('INVESTOR', 'FOUNDER');

-- CreateEnum
CREATE TYPE "PoolMemberStatus" AS ENUM ('PENDING', 'ACTIVE', 'RESPONDED', 'COMPLETED', 'REMOVED');

-- CreateEnum
CREATE TYPE "PoolPairStatus" AS ENUM ('PENDING', 'INVESTOR_YES', 'FOUNDER_YES', 'MUTUAL_YES', 'INVESTOR_NO', 'FOUNDER_NO', 'NO_MATCH', 'INTRO_SENT', 'COMPLETED');

-- CreateEnum
CREATE TYPE "EmailSequenceStep" AS ENUM ('A1_MATCH_LIST', 'A1_FU_FOLLOWUP', 'A2_CONFIRMATION', 'A3_INTRO', 'A4_FEEDBACK', 'B1_MATCH_LIST', 'B1_FU_FOLLOWUP', 'B2_CONFIRMATION', 'B3_INTRO', 'B4_FEEDBACK');

-- CreateEnum
CREATE TYPE "ActivationStatus" AS ENUM ('UNACTIVATED', 'IN_POOL', 'ACTIVATED', 'STRONG_ACTIVATED', 'AT_RISK');

-- CreateEnum
CREATE TYPE "InvestorTier" AS ENUM ('HOT', 'WARM', 'GAP_FILL');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('POOL_CREATED', 'POOL_APPROVED', 'POOL_ACTIVATED', 'POOL_CLOSED', 'EMAIL_SENT', 'EMAIL_OPENED', 'EMAIL_REPLIED', 'RESPONSE_PARSED', 'INTRO_TRIGGERED', 'INTRO_SENT', 'USER_CLASSIFIED', 'MANUAL_OVERRIDE');

-- CreateEnum
CREATE TYPE "NudgeType" AS ENUM ('POST_POOL_REMINDER', 'ACTIVATION_PROMPT', 'RE_ENGAGEMENT', 'FEEDBACK_REQUEST');

-- CreateTable
CREATE TABLE "Pool" (
    "id" TEXT NOT NULL,
    "industry" TEXT NOT NULL,
    "status" "PoolStatus" NOT NULL DEFAULT 'DRAFT',
    "minInvestors" INTEGER NOT NULL DEFAULT 3,
    "maxInvestors" INTEGER NOT NULL DEFAULT 6,
    "minFounders" INTEGER NOT NULL DEFAULT 3,
    "maxFounders" INTEGER NOT NULL DEFAULT 6,
    "slaHours" INTEGER NOT NULL DEFAULT 48,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "activatedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pool_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PoolMember" (
    "id" TEXT NOT NULL,
    "poolId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "side" "PoolMemberSide" NOT NULL,
    "status" "PoolMemberStatus" NOT NULL DEFAULT 'PENDING',
    "investorTier" "InvestorTier",
    "displayName" TEXT,
    "email" TEXT,
    "engagementScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PoolMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PoolPair" (
    "id" TEXT NOT NULL,
    "poolId" TEXT NOT NULL,
    "investorId" TEXT NOT NULL,
    "founderId" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rank" INTEGER NOT NULL DEFAULT 0,
    "status" "PoolPairStatus" NOT NULL DEFAULT 'PENDING',
    "investorName" TEXT,
    "investorEmail" TEXT,
    "founderName" TEXT,
    "founderEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PoolPair_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutreachEmail" (
    "id" TEXT NOT NULL,
    "poolPairId" TEXT NOT NULL,
    "side" "PoolMemberSide" NOT NULL,
    "step" "EmailSequenceStep" NOT NULL,
    "resendEmailId" TEXT,
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "openedAt" TIMESTAMP(3),
    "clickedAt" TIMESTAMP(3),
    "repliedAt" TIMESTAMP(3),
    "bouncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OutreachEmail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResponseRecord" (
    "id" TEXT NOT NULL,
    "outreachEmailId" TEXT NOT NULL,
    "rawResponse" TEXT,
    "parsedChoices" JSONB,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "overriddenBy" TEXT,
    "overriddenAt" TIMESTAMP(3),
    "overrideReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResponseRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Introduction" (
    "id" TEXT NOT NULL,
    "poolPairId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "introEmailBody" TEXT,
    "resendEmailId" TEXT,
    "sentAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "declinedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Introduction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserActivationStatus" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "side" "PoolMemberSide" NOT NULL,
    "status" "ActivationStatus" NOT NULL DEFAULT 'UNACTIVATED',
    "poolCount" INTEGER NOT NULL DEFAULT 0,
    "introCount" INTEGER NOT NULL DEFAULT 0,
    "responseRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "activatedAt" TIMESTAMP(3),
    "strongActivatedAt" TIMESTAMP(3),
    "lastPoolAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserActivationStatus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventLedger" (
    "id" TEXT NOT NULL,
    "type" "EventType" NOT NULL,
    "actorId" TEXT,
    "poolId" TEXT,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversionNudge" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "nudgeType" "NudgeType" NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resendEmailId" TEXT,
    "convertedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConversionNudge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchScore" (
    "id" TEXT NOT NULL,
    "poolPairId" TEXT NOT NULL,
    "investorId" TEXT NOT NULL,
    "founderId" TEXT NOT NULL,
    "totalScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "industryScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "locationScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "stageScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "chequeSizeScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "engagementScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "featureVector" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MatchScore_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PoolMember_userId_idx" ON "PoolMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PoolMember_poolId_userId_key" ON "PoolMember"("poolId", "userId");

-- CreateIndex
CREATE INDEX "PoolPair_investorId_idx" ON "PoolPair"("investorId");

-- CreateIndex
CREATE INDEX "PoolPair_founderId_idx" ON "PoolPair"("founderId");

-- CreateIndex
CREATE UNIQUE INDEX "PoolPair_poolId_investorId_founderId_key" ON "PoolPair"("poolId", "investorId", "founderId");

-- CreateIndex
CREATE INDEX "OutreachEmail_poolPairId_idx" ON "OutreachEmail"("poolPairId");

-- CreateIndex
CREATE INDEX "OutreachEmail_resendEmailId_idx" ON "OutreachEmail"("resendEmailId");

-- CreateIndex
CREATE UNIQUE INDEX "ResponseRecord_outreachEmailId_key" ON "ResponseRecord"("outreachEmailId");

-- CreateIndex
CREATE UNIQUE INDEX "Introduction_poolPairId_key" ON "Introduction"("poolPairId");

-- CreateIndex
CREATE UNIQUE INDEX "UserActivationStatus_userId_key" ON "UserActivationStatus"("userId");

-- CreateIndex
CREATE INDEX "UserActivationStatus_status_idx" ON "UserActivationStatus"("status");

-- CreateIndex
CREATE INDEX "UserActivationStatus_side_idx" ON "UserActivationStatus"("side");

-- CreateIndex
CREATE INDEX "EventLedger_type_idx" ON "EventLedger"("type");

-- CreateIndex
CREATE INDEX "EventLedger_poolId_idx" ON "EventLedger"("poolId");

-- CreateIndex
CREATE INDEX "EventLedger_createdAt_idx" ON "EventLedger"("createdAt");

-- CreateIndex
CREATE INDEX "ConversionNudge_userId_idx" ON "ConversionNudge"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "MatchScore_poolPairId_key" ON "MatchScore"("poolPairId");

-- CreateIndex
CREATE INDEX "MatchScore_investorId_idx" ON "MatchScore"("investorId");

-- CreateIndex
CREATE INDEX "MatchScore_founderId_idx" ON "MatchScore"("founderId");

-- AddForeignKey
ALTER TABLE "PoolMember" ADD CONSTRAINT "PoolMember_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "Pool"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PoolPair" ADD CONSTRAINT "PoolPair_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "Pool"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutreachEmail" ADD CONSTRAINT "OutreachEmail_poolPairId_fkey" FOREIGN KEY ("poolPairId") REFERENCES "PoolPair"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResponseRecord" ADD CONSTRAINT "ResponseRecord_outreachEmailId_fkey" FOREIGN KEY ("outreachEmailId") REFERENCES "OutreachEmail"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Introduction" ADD CONSTRAINT "Introduction_poolPairId_fkey" FOREIGN KEY ("poolPairId") REFERENCES "PoolPair"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventLedger" ADD CONSTRAINT "EventLedger_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "Pool"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchScore" ADD CONSTRAINT "MatchScore_poolPairId_fkey" FOREIGN KEY ("poolPairId") REFERENCES "PoolPair"("id") ON DELETE CASCADE ON UPDATE CASCADE;
