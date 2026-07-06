CREATE TABLE "delivery_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"delivery_enabled" boolean DEFAULT true NOT NULL,
	"pickup_enabled" boolean DEFAULT true NOT NULL,
	"phone_confirmation_required" boolean DEFAULT true NOT NULL,
	"notes_enabled" boolean DEFAULT true NOT NULL,
	"landmark_required" boolean DEFAULT false NOT NULL,
	"default_delivery_fee" numeric DEFAULT '0' NOT NULL,
	"currency" text DEFAULT 'ETB' NOT NULL,
	"zones" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "delivery_settings" ADD CONSTRAINT "delivery_settings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "delivery_settings_tenant_id_unique" ON "delivery_settings" USING btree ("tenant_id");