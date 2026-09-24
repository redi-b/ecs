CREATE TABLE "product_import_artifacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"created_by_user_id" text NOT NULL,
	"schema_version" text NOT NULL,
	"content_digest" text NOT NULL,
	"csv" text NOT NULL,
	"write_plan" jsonb NOT NULL,
	"summary" jsonb NOT NULL,
	"status" text DEFAULT 'reviewed' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "product_import_artifacts" ADD CONSTRAINT "product_import_artifacts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "product_import_artifacts_tenant_created_idx" ON "product_import_artifacts" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX "product_import_artifacts_tenant_digest_idx" ON "product_import_artifacts" USING btree ("tenant_id","content_digest");--> statement-breakpoint
CREATE INDEX "product_import_artifacts_expires_idx" ON "product_import_artifacts" USING btree ("expires_at");