CREATE TABLE "billing_payment_evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"submitted_reference" text NOT NULL,
	"normalized_reference" text NOT NULL,
	"status" text DEFAULT 'needs_review' NOT NULL,
	"verification_source" text DEFAULT 'manual_review' NOT NULL,
	"verification_result" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"reviewed_by_user_id" text,
	"review_reason" text,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "billing_payment_evidence_status_valid" CHECK ("billing_payment_evidence"."status" in ('submitted', 'verifying', 'needs_review', 'verified', 'rejected', 'superseded'))
);
--> statement-breakpoint
ALTER TABLE "billing_payment_evidence" ADD CONSTRAINT "billing_payment_evidence_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_payment_evidence" ADD CONSTRAINT "billing_payment_evidence_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "billing_payment_evidence_provider_reference_unique" ON "billing_payment_evidence" USING btree ("provider","normalized_reference");--> statement-breakpoint
CREATE INDEX "billing_payment_evidence_invoice_idx" ON "billing_payment_evidence" USING btree ("invoice_id","created_at");--> statement-breakpoint
CREATE INDEX "billing_payment_evidence_review_idx" ON "billing_payment_evidence" USING btree ("status","created_at");