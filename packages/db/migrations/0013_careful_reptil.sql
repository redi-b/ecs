CREATE TABLE "in_app_notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" text,
	"event_type" text NOT NULL,
	"dedupe_key" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"href" text,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "in_app_notifications" ADD CONSTRAINT "in_app_notifications_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "in_app_notifications_tenant_dedupe_uidx" ON "in_app_notifications" USING btree ("tenant_id","dedupe_key");--> statement-breakpoint
CREATE INDEX "in_app_notifications_tenant_created_idx" ON "in_app_notifications" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX "in_app_notifications_tenant_unread_idx" ON "in_app_notifications" USING btree ("tenant_id","read_at");