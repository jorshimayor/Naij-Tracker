-- AlterTable
ALTER TABLE "ai_explainers" ADD COLUMN     "reviewer_note" TEXT,
ADD COLUMN     "verification" JSONB,
ADD COLUMN     "verified_at" TIMESTAMP(3);
