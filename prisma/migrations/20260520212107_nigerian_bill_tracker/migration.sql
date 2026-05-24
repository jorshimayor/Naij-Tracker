-- CreateEnum
CREATE TYPE "JurisdictionType" AS ENUM ('FEDERAL_SENATE', 'FEDERAL_REPS', 'EXECUTIVE', 'STATE_ASSEMBLY', 'FCT_ASSEMBLY');

-- CreateEnum
CREATE TYPE "BillStage" AS ENUM ('INTRODUCED', 'FIRST_READING', 'SECOND_READING', 'COMMITTEE', 'THIRD_READING', 'PASSED', 'TRANSMITTED', 'ASSENTED', 'WITHDRAWN', 'LAPSED');

-- CreateEnum
CREATE TYPE "SourceDocumentType" AS ENUM ('PDF', 'HTML', 'HANSARD', 'PRESS_RELEASE');

-- CreateEnum
CREATE TYPE "SponsorRole" AS ENUM ('PRIMARY', 'CO_SPONSOR');

-- CreateEnum
CREATE TYPE "TopicSource" AS ENUM ('AI', 'EDITOR');

-- CreateEnum
CREATE TYPE "ExplainerStatus" AS ENUM ('DRAFT', 'AUTO_APPROVED', 'PENDING_REVIEW', 'APPROVED', 'FLAGGED');

-- CreateEnum
CREATE TYPE "SubscriptionChannel" AS ENUM ('EMAIL', 'WHATSAPP', 'BOTH');

-- CreateEnum
CREATE TYPE "SubscriptionFrequency" AS ENUM ('REALTIME', 'DAILY', 'WEEKLY');

-- CreateEnum
CREATE TYPE "SubscriptionTarget" AS ENUM ('BILL', 'SPONSOR', 'TOPIC', 'SEARCH', 'CHAMBER');

-- CreateEnum
CREATE TYPE "CommentStatus" AS ENUM ('VISIBLE', 'HIDDEN', 'PENDING_MODERATION');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('CITIZEN', 'CONTRIBUTOR', 'EDITOR', 'ADMIN');

-- CreateTable
CREATE TABLE "jurisdictions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "type" "JurisdictionType" NOT NULL,
    "state_code" TEXT,
    "website_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "jurisdictions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bills" (
    "id" TEXT NOT NULL,
    "jurisdiction_id" TEXT NOT NULL,
    "bill_number" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "current_stage" "BillStage" NOT NULL,
    "introduced_date" TIMESTAMP(3),
    "last_action_date" TIMESTAMP(3),
    "summary_short" TEXT,
    "summary_long" TEXT,
    "full_text" TEXT,
    "language" TEXT NOT NULL DEFAULT 'en',
    "sensitive_flag" BOOLEAN NOT NULL DEFAULT false,
    "content_hash" TEXT,
    "embedding" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bill_stage_events" (
    "id" TEXT NOT NULL,
    "bill_id" TEXT NOT NULL,
    "stage" "BillStage" NOT NULL,
    "occurred_on" TIMESTAMP(3) NOT NULL,
    "source_document_id" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bill_stage_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "legislators" (
    "id" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "photo_url" TEXT,
    "party" TEXT,
    "chamber" TEXT NOT NULL,
    "constituency" TEXT,
    "state" TEXT,
    "contact_email" TEXT,
    "phone" TEXT,
    "social_links" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "legislators_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bill_sponsors" (
    "bill_id" TEXT NOT NULL,
    "legislator_id" TEXT NOT NULL,
    "role" "SponsorRole" NOT NULL DEFAULT 'PRIMARY',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bill_sponsors_pkey" PRIMARY KEY ("bill_id","legislator_id")
);

-- CreateTable
CREATE TABLE "topics" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "parent_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "topics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bill_topics" (
    "bill_id" TEXT NOT NULL,
    "topic_id" TEXT NOT NULL,
    "source" "TopicSource" NOT NULL DEFAULT 'AI',
    "confidence" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bill_topics_pkey" PRIMARY KEY ("bill_id","topic_id")
);

-- CreateTable
CREATE TABLE "source_documents" (
    "id" TEXT NOT NULL,
    "bill_id" TEXT NOT NULL,
    "type" "SourceDocumentType" NOT NULL,
    "url" TEXT,
    "storage_key" TEXT,
    "content_hash" TEXT,
    "retrieved_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "description" TEXT,

    CONSTRAINT "source_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_explainers" (
    "id" TEXT NOT NULL,
    "bill_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "tldr" TEXT NOT NULL,
    "plain_english" TEXT NOT NULL,
    "how_it_affects_you" JSONB NOT NULL,
    "arguments_for" JSONB NOT NULL,
    "arguments_against" JSONB NOT NULL,
    "jargon_terms" JSONB NOT NULL,
    "source_citations" JSONB NOT NULL,
    "status" "ExplainerStatus" NOT NULL DEFAULT 'DRAFT',
    "model_used" TEXT NOT NULL,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewer_id" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "language" TEXT NOT NULL DEFAULT 'en',

    CONSTRAINT "ai_explainers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "whatsapp_opt_in" BOOLEAN NOT NULL DEFAULT false,
    "display_name" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'CITIZEN',
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "target_type" "SubscriptionTarget" NOT NULL,
    "target_id" TEXT NOT NULL,
    "channel" "SubscriptionChannel" NOT NULL,
    "frequency" "SubscriptionFrequency" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comments" (
    "id" TEXT NOT NULL,
    "bill_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "CommentStatus" NOT NULL DEFAULT 'PENDING_MODERATION',
    "parent_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "actor_id" TEXT,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "jurisdictions_slug_key" ON "jurisdictions"("slug");

-- CreateIndex
CREATE INDEX "bills_current_stage_idx" ON "bills"("current_stage");

-- CreateIndex
CREATE INDEX "bills_introduced_date_idx" ON "bills"("introduced_date");

-- CreateIndex
CREATE INDEX "bills_last_action_date_idx" ON "bills"("last_action_date");

-- CreateIndex
CREATE UNIQUE INDEX "bills_jurisdiction_id_bill_number_key" ON "bills"("jurisdiction_id", "bill_number");

-- CreateIndex
CREATE UNIQUE INDEX "bills_jurisdiction_id_slug_key" ON "bills"("jurisdiction_id", "slug");

-- CreateIndex
CREATE INDEX "bill_stage_events_bill_id_occurred_on_idx" ON "bill_stage_events"("bill_id", "occurred_on");

-- CreateIndex
CREATE UNIQUE INDEX "legislators_slug_key" ON "legislators"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "topics_slug_key" ON "topics"("slug");

-- CreateIndex
CREATE INDEX "source_documents_bill_id_idx" ON "source_documents"("bill_id");

-- CreateIndex
CREATE INDEX "ai_explainers_bill_id_status_idx" ON "ai_explainers"("bill_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ai_explainers_bill_id_version_language_key" ON "ai_explainers"("bill_id", "version", "language");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE INDEX "subscriptions_target_type_target_id_idx" ON "subscriptions"("target_type", "target_id");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_user_id_target_type_target_id_channel_key" ON "subscriptions"("user_id", "target_type", "target_id", "channel");

-- CreateIndex
CREATE INDEX "comments_bill_id_status_idx" ON "comments"("bill_id", "status");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_actor_id_created_at_idx" ON "audit_logs"("actor_id", "created_at");

-- AddForeignKey
ALTER TABLE "bills" ADD CONSTRAINT "bills_jurisdiction_id_fkey" FOREIGN KEY ("jurisdiction_id") REFERENCES "jurisdictions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bill_stage_events" ADD CONSTRAINT "bill_stage_events_bill_id_fkey" FOREIGN KEY ("bill_id") REFERENCES "bills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bill_stage_events" ADD CONSTRAINT "bill_stage_events_source_document_id_fkey" FOREIGN KEY ("source_document_id") REFERENCES "source_documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bill_sponsors" ADD CONSTRAINT "bill_sponsors_bill_id_fkey" FOREIGN KEY ("bill_id") REFERENCES "bills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bill_sponsors" ADD CONSTRAINT "bill_sponsors_legislator_id_fkey" FOREIGN KEY ("legislator_id") REFERENCES "legislators"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "topics" ADD CONSTRAINT "topics_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "topics"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bill_topics" ADD CONSTRAINT "bill_topics_bill_id_fkey" FOREIGN KEY ("bill_id") REFERENCES "bills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bill_topics" ADD CONSTRAINT "bill_topics_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "source_documents" ADD CONSTRAINT "source_documents_bill_id_fkey" FOREIGN KEY ("bill_id") REFERENCES "bills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_explainers" ADD CONSTRAINT "ai_explainers_bill_id_fkey" FOREIGN KEY ("bill_id") REFERENCES "bills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_explainers" ADD CONSTRAINT "ai_explainers_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_bill_id_fkey" FOREIGN KEY ("bill_id") REFERENCES "bills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "comments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
