-- AlterTable
ALTER TABLE "ChangeOrder" ADD COLUMN     "publicToken" TEXT,
ADD COLUMN     "sentAt" TIMESTAMP(3),
ADD COLUMN     "respondedAt" TIMESTAMP(3);

-- Backfill any pre-existing rows with a unique token before enforcing NOT NULL/UNIQUE
UPDATE "ChangeOrder" SET "publicToken" = md5(random()::text || clock_timestamp()::text || "id")
WHERE "publicToken" IS NULL;

ALTER TABLE "ChangeOrder" ALTER COLUMN "publicToken" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "ChangeOrder_publicToken_key" ON "ChangeOrder"("publicToken");
