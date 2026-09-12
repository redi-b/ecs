CREATE TABLE "in_app_notification_receipts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"notification_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"read_at" timestamp with time zone,
	"seen_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP INDEX "in_app_notifications_tenant_unread_idx";--> statement-breakpoint
ALTER TABLE "in_app_notifications" ADD COLUMN "category" text DEFAULT 'system' NOT NULL;--> statement-breakpoint
ALTER TABLE "in_app_notifications" ADD COLUMN "priority" text DEFAULT 'normal' NOT NULL;--> statement-breakpoint
ALTER TABLE "in_app_notifications" ADD COLUMN "audience_type" text DEFAULT 'all_members' NOT NULL;--> statement-breakpoint
ALTER TABLE "in_app_notifications" ADD COLUMN "audience" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "in_app_notifications" ADD COLUMN "group_key" text;--> statement-breakpoint
ALTER TABLE "in_app_notifications" ADD COLUMN "expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "in_app_notification_receipts" ADD CONSTRAINT "in_app_notification_receipts_notification_id_in_app_notifications_id_fk" FOREIGN KEY ("notification_id") REFERENCES "public"."in_app_notifications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "in_app_notification_receipts" ADD CONSTRAINT "in_app_notification_receipts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "in_app_notification_receipts" ADD CONSTRAINT "in_app_notification_receipts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "in_app_notification_receipts_notification_user_uidx" ON "in_app_notification_receipts" USING btree ("notification_id","user_id");--> statement-breakpoint
CREATE INDEX "in_app_notification_receipts_user_created_idx" ON "in_app_notification_receipts" USING btree ("tenant_id","user_id","created_at");--> statement-breakpoint
CREATE INDEX "in_app_notification_receipts_user_unread_idx" ON "in_app_notification_receipts" USING btree ("tenant_id","user_id","read_at");--> statement-breakpoint
CREATE INDEX "in_app_notifications_tenant_category_created_idx" ON "in_app_notifications" USING btree ("tenant_id","category","created_at");--> statement-breakpoint
CREATE INDEX "in_app_notifications_expires_idx" ON "in_app_notifications" USING btree ("expires_at");--> statement-breakpoint
INSERT INTO "in_app_notification_receipts" (
	"notification_id",
	"tenant_id",
	"user_id",
	"read_at",
	"created_at"
)
SELECT
	n."id",
	n."tenant_id",
	m."user_id",
	n."read_at",
	n."created_at"
FROM "in_app_notifications" n
INNER JOIN "tenants" t ON t."id" = n."tenant_id"
INNER JOIN "organization_members" m
	ON m."organization_id" = t."organization_id"
	AND m."status" = 'active'
WHERE n."user_id" IS NULL OR n."user_id" = m."user_id"
ON CONFLICT ("notification_id", "user_id") DO NOTHING;--> statement-breakpoint
ALTER TABLE "in_app_notifications" DROP COLUMN "user_id";--> statement-breakpoint
ALTER TABLE "in_app_notifications" DROP COLUMN "read_at";
