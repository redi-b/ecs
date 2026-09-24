ALTER TABLE "in_app_notifications" ADD COLUMN "last_event_id" uuid;--> statement-breakpoint
ALTER TABLE "in_app_notifications" ADD COLUMN "occurrence_count" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "in_app_notifications" ADD COLUMN "last_occurred_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
CREATE INDEX "in_app_notifications_tenant_last_occurred_idx" ON "in_app_notifications" USING btree ("tenant_id","last_occurred_at");