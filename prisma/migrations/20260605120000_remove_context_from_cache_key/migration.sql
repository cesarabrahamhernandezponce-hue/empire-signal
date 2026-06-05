-- Deduplicate: keep only the oldest record per (word, language)
DELETE FROM "search_records"
WHERE id NOT IN (
  SELECT DISTINCT ON (word, language) id
  FROM "search_records"
  ORDER BY word, language, "createdAt" ASC
);

-- Drop old unique constraint that included context
DROP INDEX "search_records_word_context_language_key";

-- Create new unique constraint: word + language only
CREATE UNIQUE INDEX "search_records_word_language_key" ON "search_records"("word", "language");
