CREATE TABLE "merchant_sales_document_counters" (
	"tenant_id" uuid PRIMARY KEY NOT NULL,
	"next_number" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "merchant_sales_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"order_id" text NOT NULL,
	"number" text NOT NULL,
	"kind" text NOT NULL,
	"language" text NOT NULL,
	"snapshot" jsonb NOT NULL,
	"content_hash" text NOT NULL,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "merchant_sales_document_counters" ADD CONSTRAINT "merchant_sales_document_counters_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_sales_documents" ADD CONSTRAINT "merchant_sales_documents_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "merchant_sales_documents_tenant_number_uidx" ON "merchant_sales_documents" USING btree ("tenant_id","number");--> statement-breakpoint
CREATE INDEX "merchant_sales_documents_tenant_order_idx" ON "merchant_sales_documents" USING btree ("tenant_id","order_id","created_at");