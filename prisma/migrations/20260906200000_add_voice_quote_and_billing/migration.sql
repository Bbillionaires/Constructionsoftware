-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('NONE', 'ACTIVE', 'PAST_DUE', 'CANCELED');

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "subscriptionStatus" "SubscriptionStatus" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "freeQuoteUsedAt" TIMESTAMP(3),
ADD COLUMN     "squareCustomerId" TEXT,
ADD COLUMN     "squareCardId" TEXT,
ADD COLUMN     "squareSubscriptionId" TEXT,
ADD COLUMN     "subscriptionStartedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Estimate" ADD COLUMN     "voiceTranscript" TEXT;

-- AlterTable
ALTER TABLE "EstimateLineItem" ADD COLUMN     "supplier" TEXT;
