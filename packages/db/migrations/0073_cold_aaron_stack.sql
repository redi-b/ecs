CREATE TABLE "merchant_order_cost_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"order_id" text NOT NULL,
	"line_item_id" text NOT NULL,
	"variant_id" text,
	"quantity" integer NOT NULL,
	"unit_cost_amount" integer,
	"currency_code" text DEFAULT 'etb' NOT NULL,
	"order_placed_at" timestamp with time zone NOT NULL,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "merchant_order_cost_snapshots" ADD CONSTRAINT "merchant_order_cost_snapshots_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "merchant_order_cost_snapshots_line_uidx" ON "merchant_order_cost_snapshots" USING btree ("tenant_id","order_id","line_item_id");--> statement-breakpoint
CREATE INDEX "merchant_order_cost_snapshots_tenant_order_idx" ON "merchant_order_cost_snapshots" USING btree ("tenant_id","order_id");--> statement-breakpoint
CREATE INDEX "merchant_order_cost_snapshots_tenant_placed_idx" ON "merchant_order_cost_snapshots" USING btree ("tenant_id","order_placed_at");