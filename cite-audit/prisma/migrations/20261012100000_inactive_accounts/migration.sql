-- AlterTable
ALTER TABLE "user" ADD COLUMN     "inactivityWarnedAt" TIMESTAMP(3),
ADD COLUMN     "lastActiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "user_lastActiveAt_idx" ON "user"("lastActiveAt");


-- Comptes existants : dernière activité connue = dernière session, sinon date de création du compte.
UPDATE "user" u SET "lastActiveAt" = GREATEST(
  u."createdAt",
  COALESCE((SELECT MAX(s."updatedAt") FROM "session" s WHERE s."userId" = u."id"), u."createdAt")
);
