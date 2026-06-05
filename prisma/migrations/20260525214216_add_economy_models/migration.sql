-- CreateEnum
CREATE TYPE "IndicatorPillar" AS ENUM ('MONEY_PRICES', 'FX_EXTERNAL', 'MARKETS', 'PUBLIC_FINANCE', 'DEBT', 'REAL_ECONOMY');

-- CreateEnum
CREATE TYPE "IndicatorFrequency" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'ANNUAL');

-- CreateTable
CREATE TABLE "sources" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "acronym" TEXT,
    "homepage_url" TEXT,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "source_releases" (
    "id" TEXT NOT NULL,
    "source_id" TEXT NOT NULL,
    "release_url" TEXT,
    "release_date" TIMESTAMP(3) NOT NULL,
    "content_hash" TEXT,
    "storage_key" TEXT,
    "sample" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "source_releases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "indicators" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "pillar" "IndicatorPillar" NOT NULL,
    "sub_category" TEXT,
    "unit" TEXT NOT NULL,
    "unit_label" TEXT NOT NULL,
    "frequency" "IndicatorFrequency" NOT NULL,
    "source_id" TEXT NOT NULL,
    "methodology_doc" TEXT,
    "description" TEXT,
    "sensitive_flag" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "indicators_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "observations" (
    "id" TEXT NOT NULL,
    "indicator_id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "value" DECIMAL(18,6) NOT NULL,
    "value_secondary" DECIMAL(18,6),
    "release_id" TEXT,
    "revision_of" TEXT,
    "ingested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "observations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "indicator_explainers" (
    "id" TEXT NOT NULL,
    "indicator_id" TEXT NOT NULL,
    "observation_date" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "tldr" TEXT NOT NULL,
    "plain_english" TEXT NOT NULL,
    "what_changed" TEXT NOT NULL,
    "how_it_affects_you" JSONB NOT NULL,
    "status" "ExplainerStatus" NOT NULL DEFAULT 'DRAFT',
    "model_used" TEXT NOT NULL,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewer_id" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "reviewer_note" TEXT,
    "language" TEXT NOT NULL DEFAULT 'en',

    CONSTRAINT "indicator_explainers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bill_indicator_links" (
    "bill_id" TEXT NOT NULL,
    "indicator_id" TEXT NOT NULL,
    "relevance" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "source" TEXT NOT NULL DEFAULT 'fixture',
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bill_indicator_links_pkey" PRIMARY KEY ("bill_id","indicator_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sources_slug_key" ON "sources"("slug");

-- CreateIndex
CREATE INDEX "source_releases_source_id_release_date_idx" ON "source_releases"("source_id", "release_date");

-- CreateIndex
CREATE UNIQUE INDEX "indicators_slug_key" ON "indicators"("slug");

-- CreateIndex
CREATE INDEX "indicators_pillar_idx" ON "indicators"("pillar");

-- CreateIndex
CREATE INDEX "observations_indicator_id_date_idx" ON "observations"("indicator_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "observations_indicator_id_date_key" ON "observations"("indicator_id", "date");

-- CreateIndex
CREATE INDEX "indicator_explainers_indicator_id_status_idx" ON "indicator_explainers"("indicator_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "indicator_explainers_indicator_id_observation_date_version__key" ON "indicator_explainers"("indicator_id", "observation_date", "version", "language");

-- CreateIndex
CREATE INDEX "bill_indicator_links_indicator_id_idx" ON "bill_indicator_links"("indicator_id");

-- AddForeignKey
ALTER TABLE "source_releases" ADD CONSTRAINT "source_releases_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "indicators" ADD CONSTRAINT "indicators_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "observations" ADD CONSTRAINT "observations_indicator_id_fkey" FOREIGN KEY ("indicator_id") REFERENCES "indicators"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "observations" ADD CONSTRAINT "observations_release_id_fkey" FOREIGN KEY ("release_id") REFERENCES "source_releases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "observations" ADD CONSTRAINT "observations_revision_of_fkey" FOREIGN KEY ("revision_of") REFERENCES "observations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "indicator_explainers" ADD CONSTRAINT "indicator_explainers_indicator_id_fkey" FOREIGN KEY ("indicator_id") REFERENCES "indicators"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "indicator_explainers" ADD CONSTRAINT "indicator_explainers_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bill_indicator_links" ADD CONSTRAINT "bill_indicator_links_bill_id_fkey" FOREIGN KEY ("bill_id") REFERENCES "bills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bill_indicator_links" ADD CONSTRAINT "bill_indicator_links_indicator_id_fkey" FOREIGN KEY ("indicator_id") REFERENCES "indicators"("id") ON DELETE CASCADE ON UPDATE CASCADE;
