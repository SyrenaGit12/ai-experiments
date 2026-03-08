-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL,
    "activationRecordId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actor" TEXT,
    "detail" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ActivityLog_activationRecordId_idx" ON "ActivityLog"("activationRecordId");

-- CreateIndex
CREATE INDEX "ActivityLog_createdAt_idx" ON "ActivityLog"("createdAt");

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_activationRecordId_fkey" FOREIGN KEY ("activationRecordId") REFERENCES "ActivationRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;
