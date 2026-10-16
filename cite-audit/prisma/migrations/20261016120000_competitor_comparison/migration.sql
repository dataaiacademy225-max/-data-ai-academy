-- AlterTable
ALTER TABLE "Audit" ADD COLUMN     "comparisonId" TEXT,
ADD COLUMN     "competitorName" TEXT,
ADD COLUMN     "competitorUrl" TEXT;

-- CreateTable
CREATE TABLE "Comparison" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notifiedAt" TIMESTAMP(3),

    CONSTRAINT "Comparison_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Comparison_projectId_createdAt_idx" ON "Comparison"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "Audit_comparisonId_idx" ON "Audit"("comparisonId");

-- AddForeignKey
ALTER TABLE "Audit" ADD CONSTRAINT "Audit_comparisonId_fkey" FOREIGN KEY ("comparisonId") REFERENCES "Comparison"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comparison" ADD CONSTRAINT "Comparison_projectId_isDemo_fkey" FOREIGN KEY ("projectId", "isDemo") REFERENCES "Project"("id", "isDemo") ON DELETE CASCADE ON UPDATE CASCADE;

