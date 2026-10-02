CREATE TABLE "dashboard_discovery_campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"content" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"action" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"targeting" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"cooldown_hours" integer DEFAULT 168 NOT NULL,
	"snooze_days" integer DEFAULT 30 NOT NULL,
	"max_impressions" integer,
	"created_by_user_id" text,
	"updated_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dashboard_discovery_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" text,
	"event" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "dashboard_discovery_events" ADD CONSTRAINT "dashboard_discovery_events_campaign_id_dashboard_discovery_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."dashboard_discovery_campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dashboard_discovery_events" ADD CONSTRAINT "dashboard_discovery_events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "dashboard_discovery_campaigns_key_uidx" ON "dashboard_discovery_campaigns" USING btree ("key");--> statement-breakpoint
CREATE INDEX "dashboard_discovery_events_tenant_campaign_idx" ON "dashboard_discovery_events" USING btree ("tenant_id","campaign_id");--> statement-breakpoint
CREATE INDEX "dashboard_discovery_events_campaign_event_idx" ON "dashboard_discovery_events" USING btree ("campaign_id","event");