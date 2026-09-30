CREATE TABLE "merchant_expenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"amount" integer NOT NULL,
	"currency_code" text DEFAULT 'etb' NOT NULL,
	"category" text NOT NULL,
	"occurred_on" date NOT NULL,
	"vendor_label" text,
	"reference" text,
	"note" text,
	"status" text DEFAULT 'active' NOT NULL,
	"actor_user_id" text NOT NULL,
	"voided_by_user_id" text,
	"voided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "merchant_expenses" ADD CONSTRAINT "merchant_expenses_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "merchant_expenses_tenant_occurred_idx" ON "merchant_expenses" USING btree ("tenant_id","occurred_on");--> statement-breakpoint
CREATE INDEX "merchant_expenses_tenant_status_idx" ON "merchant_expenses" USING btree ("tenant_id","status");