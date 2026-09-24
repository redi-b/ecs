CREATE TABLE "product_sales_daily" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"date" text NOT NULL,
	"product_id" text NOT NULL,
	"variant_id" text DEFAULT '' NOT NULL,
	"product_title" text,
	"variant_title" text,
	"thumbnail" text,
	"units" numeric NOT NULL,
	"paid_units" numeric NOT NULL,
	"orders" integer NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "product_sales_daily" ADD CONSTRAINT "product_sales_daily_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "product_sales_daily_bucket_uidx" ON "product_sales_daily" USING btree ("tenant_id","date","product_id","variant_id");--> statement-breakpoint
CREATE INDEX "product_sales_daily_tenant_date_idx" ON "product_sales_daily" USING btree ("tenant_id","date");