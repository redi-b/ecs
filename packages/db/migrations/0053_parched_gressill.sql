CREATE TABLE "plan_presentations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid NOT NULL,
	"public_name" text NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"feature_list" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"badge" text,
	"cta_label" text DEFAULT 'Choose plan' NOT NULL,
	"landing_visible" boolean DEFAULT false NOT NULL,
	"featured" boolean DEFAULT false NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"updated_by_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscription_trials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"subscription_id" uuid NOT NULL,
	"plan_version_id" uuid NOT NULL,
	"plan_id" uuid NOT NULL,
	"fallback_plan_version_id" uuid NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"eligibility_key" text NOT NULL,
	"initiated_by_user_id" text NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"converted_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscription_trials_status_valid" CHECK ("subscription_trials"."status" in ('active', 'converted', 'expired', 'canceled')),
	CONSTRAINT "subscription_trials_dates_valid" CHECK ("subscription_trials"."ends_at" > "subscription_trials"."started_at")
);
--> statement-breakpoint
ALTER TABLE "plan_drafts" ADD COLUMN "trial_policy" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "plan_versions" ADD COLUMN "trial_policy" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "plans" ADD COLUMN "code" text;--> statement-breakpoint
UPDATE "plans"
SET "code" = CASE
	WHEN "id" = 'a1000000-0000-4000-8000-000000000001'::uuid THEN 'starter'
	WHEN "id" = 'a1000000-0000-4000-8000-000000000002'::uuid THEN 'growth'
	ELSE trim(both '-' from regexp_replace(lower("name"), '[^a-z0-9]+', '-', 'g')) || '-' || left(replace("id"::text, '-', ''), 8)
END;--> statement-breakpoint
ALTER TABLE "plans" ALTER COLUMN "code" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "plans" ADD COLUMN "kind" text DEFAULT 'standard' NOT NULL;--> statement-breakpoint
ALTER TABLE "plans" ADD COLUMN "visibility" text DEFAULT 'private' NOT NULL;--> statement-breakpoint
ALTER TABLE "plans" ADD COLUMN "tenant_id" uuid;--> statement-breakpoint
ALTER TABLE "plans" ADD COLUMN "base_plan_version_id" uuid;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "trial_started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "trial_ends_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "trial_fallback_plan_version_id" uuid;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "trial_converted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "plan_presentations" ADD CONSTRAINT "plan_presentations_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_trials" ADD CONSTRAINT "subscription_trials_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_trials" ADD CONSTRAINT "subscription_trials_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_trials" ADD CONSTRAINT "subscription_trials_plan_version_id_plan_versions_id_fk" FOREIGN KEY ("plan_version_id") REFERENCES "public"."plan_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_trials" ADD CONSTRAINT "subscription_trials_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_trials" ADD CONSTRAINT "subscription_trials_fallback_plan_version_id_plan_versions_id_fk" FOREIGN KEY ("fallback_plan_version_id") REFERENCES "public"."plan_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "plan_presentations_plan_id_unique" ON "plan_presentations" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX "plan_presentations_landing_idx" ON "plan_presentations" USING btree ("landing_visible","display_order");--> statement-breakpoint
CREATE UNIQUE INDEX "subscription_trials_offer_claim_unique" ON "subscription_trials" USING btree ("plan_id","eligibility_key");--> statement-breakpoint
CREATE INDEX "subscription_trials_expiry_idx" ON "subscription_trials" USING btree ("status","ends_at");--> statement-breakpoint
ALTER TABLE "plans" ADD CONSTRAINT "plans_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_trial_fallback_plan_version_id_plan_versions_id_fk" FOREIGN KEY ("trial_fallback_plan_version_id") REFERENCES "public"."plan_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "plans_code_unique" ON "plans" USING btree ("code");--> statement-breakpoint
CREATE INDEX "plans_catalog_idx" ON "plans" USING btree ("status","visibility","kind");--> statement-breakpoint
CREATE INDEX "plans_tenant_id_idx" ON "plans" USING btree ("tenant_id");--> statement-breakpoint
ALTER TABLE "plans" ADD CONSTRAINT "plans_kind_valid" CHECK ("plans"."kind" in ('standard', 'custom'));--> statement-breakpoint
ALTER TABLE "plans" ADD CONSTRAINT "plans_visibility_valid" CHECK ("plans"."visibility" in ('public', 'private'));--> statement-breakpoint
ALTER TABLE "plans" ADD CONSTRAINT "plans_status_valid" CHECK ("plans"."status" in ('draft', 'active', 'archived'));--> statement-breakpoint
ALTER TABLE "plans" ADD CONSTRAINT "plans_custom_scope_valid" CHECK (("plans"."kind" = 'standard' and "plans"."tenant_id" is null) or ("plans"."kind" = 'custom' and "plans"."tenant_id" is not null));
