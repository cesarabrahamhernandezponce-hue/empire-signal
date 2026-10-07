-- ============================================================================
-- Empire Signal — full schema bootstrap
--
-- Paste this whole file into the Supabase SQL Editor of a NEW project and run
-- it once. It is prisma/migrations/* concatenated in chronological order, so
-- the result matches the schema the app expects.
--
-- GENERATED FILE — do not edit by hand.
-- Regenerate with ./scripts/build-bootstrap-sql.sh after adding a migration.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────
-- 20250522000000_init
-- ─────────────────────────────────────────────────────────────────────────
-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('FREE', 'PRO');

-- CreateEnum
CREATE TYPE "Tone" AS ENUM ('PRACTICO', 'ACADEMICO', 'CREATIVO', 'INFANTIL');

-- CreateEnum
CREATE TYPE "Language" AS ENUM ('EN', 'ES');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'CANCELLED', 'PAST_DUE', 'EXPIRED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT,
    "plan" "Plan" NOT NULL DEFAULT 'FREE',
    "searchesThisMonth" INTEGER NOT NULL DEFAULT 0,
    "searchesResetAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "search_records" (
    "id" TEXT NOT NULL,
    "word" TEXT NOT NULL,
    "context" TEXT,
    "tone" "Tone" NOT NULL DEFAULT 'PRACTICO',
    "language" "Language" NOT NULL DEFAULT 'EN',
    "analysisJson" JSONB NOT NULL,
    "shareId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "search_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_search_history" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "searchRecordId" TEXT NOT NULL,
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_search_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "follow_up_questions" (
    "id" TEXT NOT NULL,
    "searchRecordId" TEXT NOT NULL,
    "userId" TEXT,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "follow_up_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "search_events" (
    "id" TEXT NOT NULL,
    "word" TEXT NOT NULL,
    "context" TEXT,
    "tone" "Tone" NOT NULL,
    "language" "Language" NOT NULL,
    "userId" TEXT,
    "searchRecordId" TEXT NOT NULL,
    "cacheHit" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "search_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookmarks" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "searchRecordId" TEXT NOT NULL,
    "folder" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bookmarks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "word_of_the_day" (
    "id" TEXT NOT NULL,
    "searchRecordId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "featured" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT NOT NULL DEFAULT 'system',

    CONSTRAINT "word_of_the_day_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lemonSqueezyId" TEXT NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "search_records_shareId_key" ON "search_records"("shareId");

-- CreateIndex
CREATE INDEX "search_records_word_idx" ON "search_records"("word");

-- CreateIndex
CREATE INDEX "search_records_shareId_idx" ON "search_records"("shareId");

-- CreateIndex
CREATE UNIQUE INDEX "search_records_word_context_tone_language_key" ON "search_records"("word", "context", "tone", "language");

-- CreateIndex
CREATE INDEX "user_search_history_userId_viewedAt_idx" ON "user_search_history"("userId", "viewedAt");

-- CreateIndex
CREATE UNIQUE INDEX "user_search_history_userId_searchRecordId_key" ON "user_search_history"("userId", "searchRecordId");

-- CreateIndex
CREATE INDEX "follow_up_questions_userId_idx" ON "follow_up_questions"("userId");

-- CreateIndex
CREATE INDEX "follow_up_questions_searchRecordId_idx" ON "follow_up_questions"("searchRecordId");

-- CreateIndex
CREATE INDEX "search_events_word_idx" ON "search_events"("word");

-- CreateIndex
CREATE INDEX "search_events_createdAt_idx" ON "search_events"("createdAt");

-- CreateIndex
CREATE INDEX "search_events_userId_idx" ON "search_events"("userId");

-- CreateIndex
CREATE INDEX "bookmarks_userId_folder_idx" ON "bookmarks"("userId", "folder");

-- CreateIndex
CREATE UNIQUE INDEX "bookmarks_userId_searchRecordId_key" ON "bookmarks"("userId", "searchRecordId");

-- CreateIndex
CREATE UNIQUE INDEX "word_of_the_day_searchRecordId_key" ON "word_of_the_day"("searchRecordId");

-- CreateIndex
CREATE UNIQUE INDEX "word_of_the_day_date_key" ON "word_of_the_day"("date");

-- CreateIndex
CREATE INDEX "word_of_the_day_date_idx" ON "word_of_the_day"("date");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_userId_key" ON "subscriptions"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_lemonSqueezyId_key" ON "subscriptions"("lemonSqueezyId");

-- CreateIndex
CREATE INDEX "subscriptions_status_idx" ON "subscriptions"("status");

-- AddForeignKey
ALTER TABLE "user_search_history" ADD CONSTRAINT "user_search_history_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_search_history" ADD CONSTRAINT "user_search_history_searchRecordId_fkey" FOREIGN KEY ("searchRecordId") REFERENCES "search_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow_up_questions" ADD CONSTRAINT "follow_up_questions_searchRecordId_fkey" FOREIGN KEY ("searchRecordId") REFERENCES "search_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow_up_questions" ADD CONSTRAINT "follow_up_questions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "search_events" ADD CONSTRAINT "search_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "search_events" ADD CONSTRAINT "search_events_searchRecordId_fkey" FOREIGN KEY ("searchRecordId") REFERENCES "search_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_searchRecordId_fkey" FOREIGN KEY ("searchRecordId") REFERENCES "search_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "word_of_the_day" ADD CONSTRAINT "word_of_the_day_searchRecordId_fkey" FOREIGN KEY ("searchRecordId") REFERENCES "search_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ─────────────────────────────────────────────────────────────────────────
-- 20260529000000_add_ip_hash_to_search_events
-- ─────────────────────────────────────────────────────────────────────────
-- Add ipHash column to search_events for anonymous rate limiting
ALTER TABLE "search_events" ADD COLUMN "ipHash" TEXT;

-- Composite index used by the daily limit query (ipHash, cacheHit, createdAt)
CREATE INDEX "search_events_ipHash_cacheHit_createdAt_idx" ON "search_events"("ipHash", "cacheHit", "createdAt");

-- ─────────────────────────────────────────────────────────────────────────
-- 20260605000000_remove_tone
-- ─────────────────────────────────────────────────────────────────────────
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

-- ─────────────────────────────────────────────────────────────────────────
-- 20260605120000_remove_context_from_cache_key
-- ─────────────────────────────────────────────────────────────────────────
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

-- ─────────────────────────────────────────────────────────────────────────
-- 20260613000000_add_rate_limit_events
-- ─────────────────────────────────────────────────────────────────────────
-- Durable, cross-instance rate limiting for AI endpoints (ask/translate/validate)
CREATE TABLE "rate_limit_events" (
    "id" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "ipHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rate_limit_events_pkey" PRIMARY KEY ("id")
);

-- Composite index used by the windowed count query (scope, ipHash, createdAt)
CREATE INDEX "rate_limit_events_scope_ipHash_createdAt_idx" ON "rate_limit_events"("scope", "ipHash", "createdAt");

-- ─────────────────────────────────────────────────────────────────────────
-- 20260721000000_drop_dead_word_of_the_day
-- ─────────────────────────────────────────────────────────────────────────
-- Finding 20: remove the unused WordOfTheDay model/table.
-- The "word of the day" is served by a pure, deterministic function
-- (src/lib/word-of-day) computed off SearchRecord at request time. The
-- word_of_the_day table was never read or written by the app, so dropping it
-- removes dead weight (and its FK to search_records) with no code impact.
DROP TABLE IF EXISTS "word_of_the_day";

-- ─────────────────────────────────────────────────────────────────────────
-- 20260721000100_search_records_folded_lookup_index
-- ─────────────────────────────────────────────────────────────────────────
-- Finding 19: speed up the accent-insensitive cache lookup and drop a
-- duplicate index.
--
-- 1) findCachedByKey (src/lib/services/signal.ts) matches rows on
--    translate(lower(word), <accents>, <folded>) so "anonimo" hits the record
--    stored as "anónimo". Without an index on that exact expression Postgres
--    seq-scans search_records on every cache miss. This expression index (which
--    Prisma can't express in schema.prisma, hence raw SQL) makes it an index
--    scan. The (language, <folded word>) shape matches the query's WHERE.
--
-- 2) users.email is already UNIQUE (constraint users_email_key, which creates an
--    index). The separate @@index([email]) produced users_email_idx — a second
--    index over the same column. Drop the redundant one.

DROP INDEX IF EXISTS "users_email_idx";

CREATE INDEX IF NOT EXISTS "search_records_language_folded_word_idx"
  ON "search_records" (
    language,
    translate(lower(word), 'áàäâãéèëêíìïîóòöôõúùüûçñ', 'aaaaaeeeeiiiiooooouuuucn')
  );

-- OPTIONAL — enforce accent-folded uniqueness (prevents "anónimo"/"anonimo"
-- ever being cached as two rows). NOT run automatically: making the index
-- UNIQUE fails if collisions already exist, and de-duplicating means DELETEing a
-- search_records row, which CASCADES to user_search_history, follow_up_questions,
-- search_events and bookmarks. Check for collisions first (see the runbook); if
-- the count is 0 you can safely create the UNIQUE variant instead of the plain
-- index above:
--
--   CREATE UNIQUE INDEX "search_records_language_folded_word_key"
--     ON "search_records" (
--       language,
--       translate(lower(word), 'áàäâãéèëêíìïîóòöôõúùüûçñ', 'aaaaaeeeeiiiiooooouuuucn')
--     );

