ALTER TABLE "domains" ADD COLUMN "last_checked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "domains" ADD COLUMN "last_check_reason" text;--> statement-breakpoint
ALTER TABLE "domains" ADD COLUMN "last_check_detail" text;