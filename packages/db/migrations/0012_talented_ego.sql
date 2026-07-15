CREATE TYPE "public"."telegram_connect_session_status" AS ENUM('pending', 'consumed', 'expired', 'cancelled');--> statement-breakpoint
CREATE TABLE "notification_destinations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"channel" text NOT NULL,
	"target" text NOT NULL,
	"label" text DEFAULT '' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"events" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"connected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "telegram_connect_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token" text NOT NULL,
	"tenant_id" uuid NOT NULL,
	"created_by_user_id" text NOT NULL,
	"status" "telegram_connect_session_status" DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notification_destinations" ADD CONSTRAINT "notification_destinations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "telegram_connect_sessions" ADD CONSTRAINT "telegram_connect_sessions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "notification_destinations_tenant_channel_target_uidx" ON "notification_destinations" USING btree ("tenant_id","channel","target");--> statement-breakpoint
CREATE INDEX "notification_destinations_tenant_channel_idx" ON "notification_destinations" USING btree ("tenant_id","channel");--> statement-breakpoint
CREATE UNIQUE INDEX "telegram_connect_sessions_token_uidx" ON "telegram_connect_sessions" USING btree ("token");--> statement-breakpoint
CREATE INDEX "telegram_connect_sessions_tenant_status_idx" ON "telegram_connect_sessions" USING btree ("tenant_id","status");