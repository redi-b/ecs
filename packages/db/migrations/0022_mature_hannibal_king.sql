CREATE TABLE "customer_commerce_states" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"medusa_customer_id" text NOT NULL,
	"active_cart_id" text,
	"wishlist" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "customer_commerce_states" ADD CONSTRAINT "customer_commerce_states_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "customer_commerce_states_tenant_customer_unique" ON "customer_commerce_states" USING btree ("tenant_id","medusa_customer_id");