ALTER TABLE "subscriptions" ADD COLUMN "entitlement_plan_version_id" uuid;--> statement-breakpoint
UPDATE "subscriptions" SET "entitlement_plan_version_id" = "plan_version_id" WHERE "entitlement_plan_version_id" IS NULL;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_entitlement_plan_version_id_plan_versions_id_fk" FOREIGN KEY ("entitlement_plan_version_id") REFERENCES "public"."plan_versions"("id") ON DELETE no action ON UPDATE no action;
