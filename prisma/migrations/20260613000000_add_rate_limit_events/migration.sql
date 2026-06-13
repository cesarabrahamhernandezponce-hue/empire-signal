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
