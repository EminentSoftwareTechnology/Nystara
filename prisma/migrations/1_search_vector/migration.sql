-- GIN index for full-text search on Article.
-- Prisma cannot manage generated columns, so this is a raw migration.
-- Must run after 0_init which creates the Article table.

ALTER TABLE "Article"
  ADD COLUMN IF NOT EXISTS search_vector tsvector
    GENERATED ALWAYS AS (
      to_tsvector('english', coalesce(title, '') || ' ' || coalesce("contentText", ''))
    ) STORED;

CREATE INDEX IF NOT EXISTS article_search_idx ON "Article" USING GIN(search_vector);
