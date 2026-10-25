-- CreateEnum
CREATE TYPE "DigestFrequency" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY');

-- DropIndex
DROP INDEX "VerificationToken_identifier_token_key";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "emailHash" TEXT;

-- AlterTable
ALTER TABLE "VerificationToken" ADD COLUMN     "identifierHash" TEXT;

-- CreateTable
CREATE TABLE "Subscriber" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailHash" TEXT,
    "frequency" "DigestFrequency" NOT NULL DEFAULT 'WEEKLY',
    "userId" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "lastSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Subscriber_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Subscriber_email_key" ON "Subscriber"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Subscriber_emailHash_key" ON "Subscriber"("emailHash");

-- CreateIndex
CREATE UNIQUE INDEX "Subscriber_userId_key" ON "Subscriber"("userId");

-- CreateIndex
CREATE INDEX "Subscriber_frequency_confirmedAt_idx" ON "Subscriber"("frequency", "confirmedAt");

-- CreateIndex
CREATE UNIQUE INDEX "User_emailHash_key" ON "User"("emailHash");

-- CreateIndex
CREATE INDEX "VerificationToken_identifierHash_idx" ON "VerificationToken"("identifierHash");

-- AddForeignKey
ALTER TABLE "Subscriber" ADD CONSTRAINT "Subscriber_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

