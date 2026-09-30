CREATE TABLE "merchant_quotation_counters" (
	"tenant_id" uuid PRIMARY KEY NOT NULL,
	"next_number" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "merchant_quotation_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"quotation_id" uuid NOT NULL,
	"revision" integer NOT NULL,
	"snapshot" jsonb NOT NULL,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "merchant_quotations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"number" text NOT NULL,
	"status" text DEFAULT 'issued' NOT NULL,
	"current_revision" integer DEFAULT 1 NOT NULL,
	"converted_order_id" text,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "merchant_quotation_counters" ADD CONSTRAINT "merchant_quotation_counters_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_quotation_revisions" ADD CONSTRAINT "merchant_quotation_revisions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_quotation_revisions" ADD CONSTRAINT "merchant_quotation_revisions_quotation_id_merchant_quotations_id_fk" FOREIGN KEY ("quotation_id") REFERENCES "public"."merchant_quotations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_quotations" ADD CONSTRAINT "merchant_quotations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "merchant_quotation_revisions_quote_revision_uidx" ON "merchant_quotation_revisions" USING btree ("quotation_id","revision");--> statement-breakpoint
CREATE INDEX "merchant_quotation_revisions_tenant_quote_idx" ON "merchant_quotation_revisions" USING btree ("tenant_id","quotation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "merchant_quotations_tenant_number_uidx" ON "merchant_quotations" USING btree ("tenant_id","number");--> statement-breakpoint
CREATE INDEX "merchant_quotations_tenant_updated_idx" ON "merchant_quotations" USING btree ("tenant_id","updated_at");