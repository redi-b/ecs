CREATE TABLE "merchant_receiving_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"bank_code" text,
	"bank_name" text NOT NULL,
	"account_name" text,
	"account_number_encrypted" text,
	"account_last4" text,
	"label" text NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "merchant_receiving_accounts" ADD CONSTRAINT "merchant_receiving_accounts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "merchant_receiving_accounts_tenant_idx" ON "merchant_receiving_accounts" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "merchant_receiving_accounts_tenant_label_uidx" ON "merchant_receiving_accounts" USING btree ("tenant_id","label");
