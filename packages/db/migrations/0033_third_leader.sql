ALTER TABLE "audit_logs" ADD COLUMN "correlation_id" uuid DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD COLUMN "outcome" text DEFAULT 'completed' NOT NULL;--> statement-breakpoint
UPDATE "audit_logs" SET "outcome" = 'failed' WHERE "action" ~ '(^|[._])failed$';--> statement-breakpoint
UPDATE "audit_logs" SET "outcome" = 'accepted' WHERE "action" ~ '(^|[._])requested$';--> statement-breakpoint
CREATE INDEX "audit_logs_correlation_idx" ON "audit_logs" USING btree ("correlation_id");
