-- Run this once in the Supabase SQL Editor.
-- Requires: "users" and "search_records" tables to already exist (created by the Prisma migrations).

CREATE TABLE IF NOT EXISTS "user_search_history" (
  "id"              TEXT          NOT NULL,
  "userId"          TEXT          NOT NULL,
  "searchRecordId"  TEXT          NOT NULL,
  "viewedAt"        TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "user_search_history_pkey"
    PRIMARY KEY ("id"),
  CONSTRAINT "user_search_history_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE,
  CONSTRAINT "user_search_history_searchRecordId_fkey"
    FOREIGN KEY ("searchRecordId") REFERENCES "search_records"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "user_search_history_userId_searchRecordId_key"
  ON "user_search_history" ("userId", "searchRecordId");

CREATE INDEX IF NOT EXISTS "user_search_history_userId_viewedAt_idx"
  ON "user_search_history" ("userId", "viewedAt");
