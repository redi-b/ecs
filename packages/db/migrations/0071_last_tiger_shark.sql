CREATE TABLE "merchant_inventory_movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"inventory_item_id" text NOT NULL,
	"location_id" text NOT NULL,
	"product_id" text,
	"variant_id" text,
	"delta" integer NOT NULL,
	"observed_before" integer,
	"observed_after" integer,
	"reason" text NOT NULL,
	"note" text,
	"source_type" text NOT NULL,
	"source_id" text NOT NULL,
	"actor_user_id" text,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "merchant_inventory_movements" ADD CONSTRAINT "merchant_inventory_movements_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "merchant_inventory_movements_source_uidx" ON "merchant_inventory_movements" USING btree ("tenant_id","source_type","source_id","inventory_item_id","location_id");--> statement-breakpoint
CREATE INDEX "merchant_inventory_movements_tenant_item_idx" ON "merchant_inventory_movements" USING btree ("tenant_id","inventory_item_id","location_id","occurred_at");--> statement-breakpoint
CREATE INDEX "merchant_inventory_movements_tenant_variant_idx" ON "merchant_inventory_movements" USING btree ("tenant_id","product_id","variant_id","occurred_at");