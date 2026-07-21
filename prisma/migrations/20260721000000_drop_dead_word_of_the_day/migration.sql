-- Finding 20: remove the unused WordOfTheDay model/table.
-- The "word of the day" is served by a pure, deterministic function
-- (src/lib/word-of-day) computed off SearchRecord at request time. The
-- word_of_the_day table was never read or written by the app, so dropping it
-- removes dead weight (and its FK to search_records) with no code impact.
DROP TABLE IF EXISTS "word_of_the_day";
