CREATE TABLE "metric_rollup_checkpoints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"rollup_key" text NOT NULL,
	"rollup_version" integer NOT NULL,
	"timezone" text NOT NULL,
	"watermark" timestamp with time zone NOT NULL,
	"last_successful_at" timestamp with time zone NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "daily_metrics" ALTER COLUMN "dimension_key" SET DEFAULT '';--> statement-breakpoint
UPDATE "daily_metrics" SET "dimension_key" = '' WHERE "dimension_key" IS NULL;--> statement-breakpoint
ALTER TABLE "daily_metrics" ALTER COLUMN "dimension_key" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "daily_metrics" ALTER COLUMN "dimension_value" SET DEFAULT '';--> statement-breakpoint
UPDATE "daily_metrics" SET "dimension_value" = '' WHERE "dimension_value" IS NULL;--> statement-breakpoint
ALTER TABLE "daily_metrics" ALTER COLUMN "dimension_value" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "daily_metrics" ADD COLUMN "currency_code" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "daily_metrics" ADD COLUMN "timezone" text DEFAULT 'Africa/Addis_Ababa' NOT NULL;--> statement-breakpoint
ALTER TABLE "daily_metrics" ADD COLUMN "rollup_version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "daily_metrics" ADD COLUMN "source_window_start" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "daily_metrics" ADD COLUMN "source_window_end" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "metric_rollup_checkpoints" ADD CONSTRAINT "metric_rollup_checkpoints_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "metric_rollup_checkpoints_tenant_key_version_uidx" ON "metric_rollup_checkpoints" USING btree ("tenant_id","rollup_key","rollup_version");--> statement-breakpoint
DELETE FROM "daily_metrics"
WHERE "id" IN (
	SELECT "id"
	FROM (
		SELECT
			"id",
			row_number() OVER (
				PARTITION BY "tenant_id", "date", "metric_key", "dimension_key", "dimension_value", "currency_code", "rollup_version"
				ORDER BY "computed_at" DESC, "id" DESC
			) AS "duplicate_rank"
		FROM "daily_metrics"
	) AS "ranked_metrics"
	WHERE "duplicate_rank" > 1
);--> statement-breakpoint
CREATE UNIQUE INDEX "daily_metrics_logical_bucket_uidx" ON "daily_metrics" USING btree ("tenant_id","date","metric_key","dimension_key","dimension_value","currency_code","rollup_version");--> statement-breakpoint
CREATE INDEX "daily_metrics_tenant_date_idx" ON "daily_metrics" USING btree ("tenant_id","date");
