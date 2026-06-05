-- Drop old unique index that included tone
DROP INDEX "search_records_word_context_tone_language_key";

-- Remove tone column from search_records
ALTER TABLE "search_records" DROP COLUMN "tone";

-- Remove tone column from search_events
ALTER TABLE "search_events" DROP COLUMN "tone";

-- Drop the Tone enum
DROP TYPE "Tone";

-- Create new unique index without tone
CREATE UNIQUE INDEX "search_records_word_context_language_key" ON "search_records"("word", "context", "language");
