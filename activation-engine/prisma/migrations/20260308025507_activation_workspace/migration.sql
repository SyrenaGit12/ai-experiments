-- CreateEnum
CREATE TYPE "ActivationSide" AS ENUM ('INVESTOR', 'FOUNDER');

-- CreateEnum
CREATE TYPE "ActivationStage" AS ENUM ('NEW', 'S1_MATCHES_SENT', 'S2_USER_RESPONDED', 'S3_COUNTERPARTY_ASKED', 'S3_FEEDBACK_RECEIVED', 'ACTIVATED', 'STALLED', 'DECLINED');

-- CreateTable
CREATE TABLE "ActivationRecord" (
    "id" TEXT NOT NULL,
    "syrenaUserId" TEXT NOT NULL,
    "side" "ActivationSide" NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "company" TEXT,
    "industry" TEXT NOT NULL,
    "fundingStage" TEXT,
    "stage" "ActivationStage" NOT NULL DEFAULT 'NEW',
    "owner" TEXT,
    "matchesSentAt" TIMESTAMP(3),
    "matchesSentBy" TEXT,
    "respondedAt" TIMESTAMP(3),
    "selectedMatchId" TEXT,
    "counterpartyAskedAt" TIMESTAMP(3),
    "counterpartyRespondedAt" TIMESTAMP(3),
    "outcome" TEXT,
    "activatedAt" TIMESTAMP(3),
    "notes" TEXT,
    "slaDeadline" TIMESTAMP(3),
    "poolId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActivationRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivationMatch" (
    "id" TEXT NOT NULL,
    "activationRecordId" TEXT NOT NULL,
    "matchSyrenaUserId" TEXT NOT NULL,
    "matchSide" "ActivationSide" NOT NULL,
    "matchName" TEXT NOT NULL,
    "matchEmail" TEXT NOT NULL,
    "matchCompany" TEXT,
    "matchIndustry" TEXT,
    "whyRelevant" TEXT,
    "selected" BOOLEAN NOT NULL DEFAULT false,
    "counterpartyResponse" TEXT,
    "introSent" BOOLEAN NOT NULL DEFAULT false,
    "introSentAt" TIMESTAMP(3),
    "emailSentToMatch" BOOLEAN NOT NULL DEFAULT false,
    "emailSentToMatchAt" TIMESTAMP(3),
    "feedback" TEXT,
    "feedbackDelivered" BOOLEAN NOT NULL DEFAULT false,
    "feedbackDeliveredAt" TIMESTAMP(3),
    "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActivationMatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailTemplate" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "side" "ActivationSide",
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ActivationRecord_stage_idx" ON "ActivationRecord"("stage");

-- CreateIndex
CREATE INDEX "ActivationRecord_side_idx" ON "ActivationRecord"("side");

-- CreateIndex
CREATE INDEX "ActivationRecord_owner_idx" ON "ActivationRecord"("owner");

-- CreateIndex
CREATE INDEX "ActivationRecord_industry_idx" ON "ActivationRecord"("industry");

-- CreateIndex
CREATE UNIQUE INDEX "ActivationRecord_syrenaUserId_key" ON "ActivationRecord"("syrenaUserId");

-- CreateIndex
CREATE INDEX "ActivationMatch_activationRecordId_idx" ON "ActivationMatch"("activationRecordId");

-- CreateIndex
CREATE INDEX "ActivationMatch_matchSyrenaUserId_idx" ON "ActivationMatch"("matchSyrenaUserId");

-- CreateIndex
CREATE UNIQUE INDEX "EmailTemplate_slug_key" ON "EmailTemplate"("slug");

-- AddForeignKey
ALTER TABLE "ActivationMatch" ADD CONSTRAINT "ActivationMatch_activationRecordId_fkey" FOREIGN KEY ("activationRecordId") REFERENCES "ActivationRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;
