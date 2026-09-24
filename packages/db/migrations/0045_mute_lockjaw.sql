CREATE TABLE "email_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid,
	"template_key" text NOT NULL,
	"template_version" integer,
	"locale" text NOT NULL,
	"recipient" text NOT NULL,
	"sender_profile" text NOT NULL,
	"variables_encrypted" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"status" "notification_status" DEFAULT 'pending' NOT NULL,
	"provider_reference" text,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "email_template_drafts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_key" text NOT NULL,
	"locale" text NOT NULL,
	"subject" text NOT NULL,
	"preheader" text DEFAULT '' NOT NULL,
	"content" jsonb NOT NULL,
	"sender_profile" text NOT NULL,
	"reply_to" text,
	"published_version" integer,
	"created_by_principal_id" uuid,
	"updated_by_principal_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_template_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_key" text NOT NULL,
	"locale" text NOT NULL,
	"version" integer NOT NULL,
	"subject" text NOT NULL,
	"preheader" text DEFAULT '' NOT NULL,
	"content" jsonb NOT NULL,
	"sender_profile" text NOT NULL,
	"reply_to" text,
	"published_by_principal_id" uuid,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "email_deliveries" ADD CONSTRAINT "email_deliveries_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_template_drafts" ADD CONSTRAINT "email_template_drafts_created_by_principal_id_platform_principals_id_fk" FOREIGN KEY ("created_by_principal_id") REFERENCES "public"."platform_principals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_template_drafts" ADD CONSTRAINT "email_template_drafts_updated_by_principal_id_platform_principals_id_fk" FOREIGN KEY ("updated_by_principal_id") REFERENCES "public"."platform_principals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_template_versions" ADD CONSTRAINT "email_template_versions_published_by_principal_id_platform_principals_id_fk" FOREIGN KEY ("published_by_principal_id") REFERENCES "public"."platform_principals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "email_deliveries_idempotency_uidx" ON "email_deliveries" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "email_deliveries_status_created_idx" ON "email_deliveries" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "email_deliveries_tenant_created_idx" ON "email_deliveries" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "email_template_drafts_key_locale_uidx" ON "email_template_drafts" USING btree ("template_key","locale");--> statement-breakpoint
CREATE INDEX "email_template_drafts_updated_idx" ON "email_template_drafts" USING btree ("updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "email_template_versions_key_locale_version_uidx" ON "email_template_versions" USING btree ("template_key","locale","version");--> statement-breakpoint
CREATE INDEX "email_template_versions_published_idx" ON "email_template_versions" USING btree ("published_at");
