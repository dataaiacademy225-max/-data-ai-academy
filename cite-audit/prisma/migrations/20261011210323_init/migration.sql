-- CreateEnum
CREATE TYPE "AuditStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'PARTIAL', 'FAILED', 'CANCELED');

-- CreateEnum
CREATE TYPE "Pillar" AS ENUM ('CLARIFIER', 'INDEXER', 'TUNNEL', 'ENCLENCHER', 'GEO');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('CRITIQUE', 'IMPORTANT', 'RECOMMANDE');

-- CreateEnum
CREATE TYPE "AiProviderKind" AS ENUM ('OPENAI_COMPATIBLE', 'PERPLEXITY', 'ANTHROPIC', 'GEMINI');

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "siteUrl" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "sector" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "city" TEXT,
    "primaryTarget" TEXT NOT NULL,
    "competitors" JSONB NOT NULL DEFAULT '[]',
    "geoQueries" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "ownershipAttestedAt" TIMESTAMP(3) NOT NULL,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Audit" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "status" "AuditStatus" NOT NULL DEFAULT 'QUEUED',
    "scoringVersion" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lockedAt" TIMESTAMP(3),
    "queuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "scoreTotal" INTEGER,
    "scoreClarifier" DOUBLE PRECISION,
    "scoreIndexer" DOUBLE PRECISION,
    "scoreTunnel" DOUBLE PRECISION,
    "scoreEnclencher" DOUBLE PRECISION,
    "geoIndex" INTEGER,
    "coverage" DOUBLE PRECISION,
    "inputSnapshot" JSONB NOT NULL,
    "reportSnapshot" JSONB,
    "errorCode" TEXT,

    CONSTRAINT "Audit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PageAnalysis" (
    "id" TEXT NOT NULL,
    "auditId" TEXT NOT NULL,
    "requestedUrl" TEXT NOT NULL,
    "finalUrl" TEXT,
    "httpStatus" INTEGER,
    "redirectChain" JSONB NOT NULL DEFAULT '[]',
    "pageType" TEXT,
    "robotsAllowed" BOOLEAN NOT NULL,
    "bytes" INTEGER,
    "fetchMs" INTEGER,
    "facts" JSONB,
    "fetchError" TEXT,
    "analyzedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PageAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Finding" (
    "id" TEXT NOT NULL,
    "auditId" TEXT NOT NULL,
    "pillar" "Pillar" NOT NULL,
    "criterionCode" TEXT NOT NULL,
    "priority" "Priority" NOT NULL,
    "observation" TEXT NOT NULL,
    "evidence" JSONB NOT NULL,
    "impact" TEXT NOT NULL,
    "recommendation" TEXT NOT NULL,
    "effort" TEXT,
    "dismissedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Finding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiQueryResult" (
    "id" TEXT NOT NULL,
    "auditId" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "askedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "provider" "AiProviderKind" NOT NULL,
    "model" TEXT NOT NULL,
    "brandDetected" TEXT,
    "brandMentioned" BOOLEAN NOT NULL,
    "brandRecommended" BOOLEAN NOT NULL,
    "approxPosition" INTEGER,
    "positionRatio" DOUBLE PRECISION,
    "competitorsMentioned" JSONB NOT NULL DEFAULT '[]',
    "sources" JSONB NOT NULL DEFAULT '[]',
    "rawResponse" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "errorCode" TEXT,
    "errorMessage" TEXT,

    CONSTRAINT "AiQueryResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- CreateIndex
CREATE INDEX "session_userId_idx" ON "session"("userId");

-- CreateIndex
CREATE INDEX "account_userId_idx" ON "account"("userId");

-- CreateIndex
CREATE INDEX "verification_identifier_idx" ON "verification"("identifier");

-- CreateIndex
CREATE INDEX "Project_userId_createdAt_idx" ON "Project"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Project_id_isDemo_key" ON "Project"("id", "isDemo");

-- CreateIndex
CREATE INDEX "Audit_projectId_queuedAt_idx" ON "Audit"("projectId", "queuedAt");

-- CreateIndex
CREATE INDEX "Audit_status_queuedAt_idx" ON "Audit"("status", "queuedAt");

-- CreateIndex
CREATE INDEX "PageAnalysis_auditId_idx" ON "PageAnalysis"("auditId");

-- CreateIndex
CREATE INDEX "Finding_auditId_priority_idx" ON "Finding"("auditId", "priority");

-- CreateIndex
CREATE INDEX "AiQueryResult_auditId_idx" ON "AiQueryResult"("auditId");

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Audit" ADD CONSTRAINT "Audit_projectId_isDemo_fkey" FOREIGN KEY ("projectId", "isDemo") REFERENCES "Project"("id", "isDemo") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PageAnalysis" ADD CONSTRAINT "PageAnalysis_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "Audit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Finding" ADD CONSTRAINT "Finding_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "Audit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiQueryResult" ADD CONSTRAINT "AiQueryResult_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "Audit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
