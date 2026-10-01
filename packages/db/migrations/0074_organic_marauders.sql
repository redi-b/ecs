ALTER TABLE "domains" ADD COLUMN "activated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "domains" ADD COLUMN "warning_since" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "domains" ADD COLUMN "warning_reason" text;