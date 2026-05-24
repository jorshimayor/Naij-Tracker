-- AlterTable
ALTER TABLE "users" ADD COLUMN     "last_daily_digest_at" TIMESTAMP(3),
ADD COLUMN     "last_weekly_digest_at" TIMESTAMP(3);
