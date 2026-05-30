-- Add ipHash column to search_events for anonymous rate limiting
ALTER TABLE "search_events" ADD COLUMN "ipHash" TEXT;

-- Composite index used by the daily limit query (ipHash, cacheHit, createdAt)
CREATE INDEX "search_events_ipHash_cacheHit_createdAt_idx" ON "search_events"("ipHash", "cacheHit", "createdAt");
