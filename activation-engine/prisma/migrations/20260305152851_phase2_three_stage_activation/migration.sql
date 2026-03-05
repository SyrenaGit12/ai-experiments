-- AlterTable
ALTER TABLE "MatchScore" ADD COLUMN     "outcome" TEXT,
ADD COLUMN     "outcomeAt" TIMESTAMP(3),
ADD COLUMN     "outcomeReason" TEXT;

-- AlterTable
ALTER TABLE "Pool" ADD COLUMN     "isTestPool" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "ownerId" TEXT,
ADD COLUMN     "ownerName" TEXT;

-- AlterTable
ALTER TABLE "PoolMember" ADD COLUMN     "matchesPresentedIds" JSONB,
ADD COLUMN     "respondedAt" TIMESTAMP(3),
ADD COLUMN     "selectedMatchIds" JSONB,
ADD COLUMN     "stage" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "stageCompletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "PoolPair" ADD COLUMN     "crossMatchOutcome" TEXT,
ADD COLUMN     "feedbackDeliveredAt" TIMESTAMP(3),
ADD COLUMN     "founderFeedback" TEXT,
ADD COLUMN     "founderFeedbackPositive" BOOLEAN,
ADD COLUMN     "founderSelected" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "investorFeedback" TEXT,
ADD COLUMN     "investorFeedbackPositive" BOOLEAN,
ADD COLUMN     "investorSelected" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "presentedToFounder" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "presentedToInvestor" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "PersonalizationLine" (
    "id" TEXT NOT NULL,
    "poolPairId" TEXT NOT NULL,
    "side" "PoolMemberSide" NOT NULL,
    "line" TEXT NOT NULL,
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "approvedBy" TEXT,

    CONSTRAINT "PersonalizationLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NewJoinerMatch" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "side" "PoolMemberSide" NOT NULL,
    "matchUserId" TEXT NOT NULL,
    "userName" TEXT,
    "userEmail" TEXT,
    "matchName" TEXT,
    "matchEmail" TEXT,
    "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "whyRelevant" TEXT,
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "stage" INTEGER NOT NULL DEFAULT 0,
    "selected" BOOLEAN NOT NULL DEFAULT false,
    "feedback" TEXT,
    "feedbackPositive" BOOLEAN,
    "emailSentAt" TIMESTAMP(3),
    "isTestMode" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NewJoinerMatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PersonalizationLine_poolPairId_idx" ON "PersonalizationLine"("poolPairId");

-- CreateIndex
CREATE INDEX "NewJoinerMatch_userId_idx" ON "NewJoinerMatch"("userId");

-- CreateIndex
CREATE INDEX "NewJoinerMatch_matchUserId_idx" ON "NewJoinerMatch"("matchUserId");

-- AddForeignKey
ALTER TABLE "PersonalizationLine" ADD CONSTRAINT "PersonalizationLine_poolPairId_fkey" FOREIGN KEY ("poolPairId") REFERENCES "PoolPair"("id") ON DELETE CASCADE ON UPDATE CASCADE;
