CREATE TABLE "product_option_sets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"title" text NOT NULL,
	"values" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "product_option_sets" ADD CONSTRAINT "product_option_sets_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "product_option_sets_tenant_idx" ON "product_option_sets" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "product_option_sets_tenant_title_uidx" ON "product_option_sets" USING btree ("tenant_id","title");