-- CreateEnum
CREATE TYPE "Reaction" AS ENUM ('LIKE', 'DISLIKE');

-- DropIndex
DROP INDEX "Comment_articleId_idx";

-- AlterTable
ALTER TABLE "Article" ADD COLUMN     "theme" TEXT NOT NULL DEFAULT 'classic';

-- AlterTable
ALTER TABLE "Comment" ADD COLUMN     "guestName" TEXT,
ALTER COLUMN "authorId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "ArticleFeedback" (
    "articleId" TEXT NOT NULL,
    "voterId" TEXT NOT NULL,
    "userId" TEXT,
    "reaction" "Reaction",
    "rating" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ArticleFeedback_pkey" PRIMARY KEY ("articleId","voterId")
);

-- CreateIndex
CREATE INDEX "ArticleFeedback_userId_idx" ON "ArticleFeedback"("userId");

-- CreateIndex
CREATE INDEX "ArticleFeedback_updatedAt_idx" ON "ArticleFeedback"("updatedAt");

-- CreateIndex
CREATE INDEX "Comment_articleId_createdAt_idx" ON "Comment"("articleId", "createdAt");

-- AddForeignKey
ALTER TABLE "ArticleFeedback" ADD CONSTRAINT "ArticleFeedback_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArticleFeedback" ADD CONSTRAINT "ArticleFeedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Constraints Prisma cannot express
ALTER TABLE "ArticleFeedback" ADD CONSTRAINT "ArticleFeedback_rating_check" CHECK ("rating" IS NULL OR "rating" BETWEEN 1 AND 5);
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_author_check" CHECK ("authorId" IS NOT NULL OR "guestName" IS NOT NULL);
