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

