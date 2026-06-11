-- ============================================================
-- CACHE PURGE — Empire Signal
-- Run in: Supabase Dashboard → SQL Editor
-- ============================================================
--
-- ⚠️  ANALYTICS WARNING — READ BEFORE RUNNING ⚠️
--
-- search_events has onDelete: Cascade on searchRecordId.
-- Deleting search_records will CASCADE-DELETE every row in:
--   • search_events      ← ALL historical analytics (cache hits,
--                           rate limit events, every word searched)
--   • user_search_history
--   • bookmarks
--   • follow_up_questions
--
-- If you want to keep analytics history, export search_events first:
--   In Supabase Dashboard → Table Editor → search_events → Export CSV
--   (or run: COPY search_events TO STDOUT WITH CSV HEADER;)
--
-- Only proceed once you are certain you want to lose that data,
-- or have exported it.
--
-- ============================================================

-- Step 1: remove WordOfTheDay references first — no cascade on this FK
DELETE FROM word_of_the_day;

-- Step 2: delete all cached analyses; cascades to:
--   search_events, user_search_history, bookmarks, follow_up_questions
DELETE FROM search_records;
