-- CreateEnum
CREATE TYPE "AccessInterest" AS ENUM ('SITE_AUDIT', 'AI_TRACKING', 'SEARCH_CONSOLE', 'COMPETITORS');

-- AlterTable
ALTER TABLE "AccessRequest" ADD COLUMN     "campaign" TEXT,
ADD COLUMN     "interest" "AccessInterest",
ADD COLUMN     "source" TEXT;

