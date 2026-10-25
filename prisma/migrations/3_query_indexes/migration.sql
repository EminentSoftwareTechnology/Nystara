CREATE INDEX "Article_published_publishedAt_idx"
  ON "Article"("published", "publishedAt");

CREATE INDEX "Article_authorId_published_publishedAt_idx"
  ON "Article"("authorId", "published", "publishedAt");

CREATE INDEX "ArticleTag_tagId_idx"
  ON "ArticleTag"("tagId");
