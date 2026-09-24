CREATE TABLE "storefront_template_drafts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"template_version_id" uuid NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"theme_tokens" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "storefront_template_drafts" ADD CONSTRAINT "storefront_template_drafts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "storefront_template_drafts" ADD CONSTRAINT "storefront_template_drafts_template_version_id_storefront_template_versions_id_fk" FOREIGN KEY ("template_version_id") REFERENCES "public"."storefront_template_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "storefront_template_drafts_tenant_version_unique" ON "storefront_template_drafts" USING btree ("tenant_id","template_version_id");