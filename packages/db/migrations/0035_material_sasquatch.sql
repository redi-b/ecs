CREATE TABLE "plan_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"fingerprint" text NOT NULL,
	"name" text NOT NULL,
	"price" numeric NOT NULL,
	"currency" text DEFAULT 'ETB' NOT NULL,
	"billing_interval" text DEFAULT 'month' NOT NULL,
	"limits" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"features" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "plan_version_id" uuid;--> statement-breakpoint
INSERT INTO "plan_versions" (
	"plan_id",
	"version",
	"fingerprint",
	"name",
	"price",
	"currency",
	"billing_interval",
	"limits",
	"features"
)
SELECT
	"id",
	1,
	'legacy-v1-' || "id"::text,
	"name",
	"price",
	'ETB',
	'month',
	"limits",
	"features"
FROM "plans";--> statement-breakpoint
UPDATE "subscriptions"
SET "plan_version_id" = "plan_versions"."id"
FROM "plan_versions"
WHERE "subscriptions"."plan_id" = "plan_versions"."plan_id"
	AND "plan_versions"."version" = 1;--> statement-breakpoint
ALTER TABLE "plan_versions" ADD CONSTRAINT "plan_versions_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "plan_versions_plan_id_version_unique" ON "plan_versions" USING btree ("plan_id","version");--> statement-breakpoint
CREATE UNIQUE INDEX "plan_versions_plan_id_fingerprint_unique" ON "plan_versions" USING btree ("plan_id","fingerprint");--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_version_id_plan_versions_id_fk" FOREIGN KEY ("plan_version_id") REFERENCES "public"."plan_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "subscriptions_plan_version_id_idx" ON "subscriptions" USING btree ("plan_version_id");
