-- Columns written by @auth/prisma-adapter on sign-up; without them createUser fails.
ALTER TABLE "User"
  ADD COLUMN "emailVerified" TIMESTAMP(3),
  ADD COLUMN "image" TEXT;

-- GDPR right to erasure: deleting a User must remove the rows they own.
-- These were ON DELETE RESTRICT, so any user with activity could not be deleted.
ALTER TABLE "Article" DROP CONSTRAINT "Article_authorId_fkey";
ALTER TABLE "Article" ADD CONSTRAINT "Article_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Comment" DROP CONSTRAINT "Comment_authorId_fkey";
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Clap" DROP CONSTRAINT "Clap_userId_fkey";
ALTER TABLE "Clap" ADD CONSTRAINT "Clap_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Bookmark" DROP CONSTRAINT "Bookmark_userId_fkey";
ALTER TABLE "Bookmark" ADD CONSTRAINT "Bookmark_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Follow" DROP CONSTRAINT "Follow_followerId_fkey";
ALTER TABLE "Follow" ADD CONSTRAINT "Follow_followerId_fkey" FOREIGN KEY ("followerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Follow" DROP CONSTRAINT "Follow_followingId_fkey";
ALTER TABLE "Follow" ADD CONSTRAINT "Follow_followingId_fkey" FOREIGN KEY ("followingId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Subscription" DROP CONSTRAINT "Subscription_userId_fkey";
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- FK indexes for the per-article _count subqueries on every feed card, and for cascades.
CREATE INDEX "Comment_articleId_idx" ON "Comment"("articleId");
CREATE INDEX "Clap_articleId_idx" ON "Clap"("articleId");
CREATE INDEX "Bookmark_articleId_idx" ON "Bookmark"("articleId");
CREATE INDEX "Follow_followingId_idx" ON "Follow"("followingId");
CREATE INDEX "ArticleView_articleId_idx" ON "ArticleView"("articleId");
