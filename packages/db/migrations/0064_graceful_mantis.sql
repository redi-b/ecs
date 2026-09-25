ALTER TABLE "subscriptions" ADD COLUMN "renewal_plan_version_id" uuid;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "renewal_effective_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_renewal_plan_version_id_plan_versions_id_fk" FOREIGN KEY ("renewal_plan_version_id") REFERENCES "public"."plan_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "subscriptions_renewal_plan_version_id_idx" ON "subscriptions" USING btree ("renewal_plan_version_id");--> statement-breakpoint
UPDATE "subscriptions"
SET "current_period_start" = COALESCE("current_period_start", now()),
    "current_period_end" = COALESCE("current_period_end", now() + interval '1 month')
WHERE "status" IN ('active', 'past_due')
  AND ("current_period_start" IS NULL OR "current_period_end" IS NULL);
