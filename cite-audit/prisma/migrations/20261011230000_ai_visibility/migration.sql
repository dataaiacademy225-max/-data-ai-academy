-- Les anciens résultats IA (données de démonstration uniquement) étaient rattachés aux audits : ils sont supprimés
-- avant le changement de structure. Relancer `pnpm db:seed` pour recréer la démonstration.
DELETE FROM "AiQueryResult";

-- CreateEnum
CREATE TYPE "AiQueryStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED');

-- DropForeignKey
ALTER TABLE "AiQueryResult" DROP CONSTRAINT "AiQueryResult_auditId_fkey";

-- DropIndex
DROP INDEX "AiQueryResult_auditId_idx";

-- AlterTable
ALTER TABLE "AiQueryResult" DROP COLUMN "auditId",
ADD COLUMN     "attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "brandCited" BOOLEAN,
ADD COLUMN     "brandExcerpt" TEXT,
ADD COLUMN     "costUsd" DOUBLE PRECISION,
ADD COLUMN     "httpStatus" INTEGER,
ADD COLUMN     "latencyMs" INTEGER,
ADD COLUMN     "position" INTEGER NOT NULL,
ADD COLUMN     "rawPayload" JSONB,
ADD COLUMN     "requestedModel" TEXT NOT NULL,
ADD COLUMN     "runId" TEXT NOT NULL,
ADD COLUMN     "status" "AiQueryStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "usage" JSONB,
ALTER COLUMN "askedAt" DROP NOT NULL,
ALTER COLUMN "askedAt" DROP DEFAULT,
ALTER COLUMN "model" DROP NOT NULL,
ALTER COLUMN "brandMentioned" DROP NOT NULL,
ALTER COLUMN "brandRecommended" DROP NOT NULL,
ALTER COLUMN "rawResponse" DROP NOT NULL,
ALTER COLUMN "confidence" DROP NOT NULL;

-- CreateTable
CREATE TABLE "AiVisibilityRun" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "status" "AuditStatus" NOT NULL DEFAULT 'QUEUED',
    "provider" "AiProviderKind" NOT NULL,
    "model" TEXT NOT NULL,
    "queryCount" INTEGER NOT NULL,
    "estimatedCostMinUsd" DOUBLE PRECISION NOT NULL,
    "estimatedCostMaxUsd" DOUBLE PRECISION NOT NULL,
    "actualCostUsd" DOUBLE PRECISION,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lockedAt" TIMESTAMP(3),
    "queuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "progress" JSONB,
    "errorCode" TEXT,
    "inputSnapshot" JSONB NOT NULL,

    CONSTRAINT "AiVisibilityRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiVisibilityRun_projectId_queuedAt_idx" ON "AiVisibilityRun"("projectId", "queuedAt");

-- CreateIndex
CREATE INDEX "AiVisibilityRun_status_queuedAt_idx" ON "AiVisibilityRun"("status", "queuedAt");

-- CreateIndex
CREATE INDEX "AiQueryResult_runId_status_idx" ON "AiQueryResult"("runId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AiQueryResult_runId_position_key" ON "AiQueryResult"("runId", "position");

-- AddForeignKey
ALTER TABLE "AiVisibilityRun" ADD CONSTRAINT "AiVisibilityRun_projectId_isDemo_fkey" FOREIGN KEY ("projectId", "isDemo") REFERENCES "Project"("id", "isDemo") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiQueryResult" ADD CONSTRAINT "AiQueryResult_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AiVisibilityRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

