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
