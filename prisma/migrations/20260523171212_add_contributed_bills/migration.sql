-- CreateEnum
CREATE TYPE "ContributionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'PUBLISHED');

-- CreateTable
CREATE TABLE "contributed_bills" (
    "id" TEXT NOT NULL,
    "submitter_id" TEXT NOT NULL,
    "jurisdiction_id" TEXT NOT NULL,
    "bill_number" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "source_url" TEXT,
    "full_text" TEXT,
    "submitter_note" TEXT,
    "status" "ContributionStatus" NOT NULL DEFAULT 'PENDING',
    "reviewer_id" TEXT,
    "reviewer_note" TEXT,
    "published_bill_id" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contributed_bills_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contributed_bills_submitter_id_status_idx" ON "contributed_bills"("submitter_id", "status");

-- CreateIndex
CREATE INDEX "contributed_bills_status_created_at_idx" ON "contributed_bills"("status", "created_at");

-- AddForeignKey
ALTER TABLE "contributed_bills" ADD CONSTRAINT "contributed_bills_submitter_id_fkey" FOREIGN KEY ("submitter_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contributed_bills" ADD CONSTRAINT "contributed_bills_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contributed_bills" ADD CONSTRAINT "contributed_bills_jurisdiction_id_fkey" FOREIGN KEY ("jurisdiction_id") REFERENCES "jurisdictions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contributed_bills" ADD CONSTRAINT "contributed_bills_published_bill_id_fkey" FOREIGN KEY ("published_bill_id") REFERENCES "bills"("id") ON DELETE SET NULL ON UPDATE CASCADE;
