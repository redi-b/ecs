CREATE TABLE "billing_provider_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"event_key" text NOT NULL,
	"event_type" text NOT NULL,
	"tenant_id" uuid NOT NULL,
	"invoice_id" uuid,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processing_started_at" timestamp with time zone,
	"processed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "billing_provider_events_status_valid" CHECK ("billing_provider_events"."status" in ('pending', 'processing', 'completed', 'failed')),
	CONSTRAINT "billing_provider_events_attempts_nonnegative" CHECK ("billing_provider_events"."attempts" >= 0)
);
--> statement-breakpoint
ALTER TABLE "billing_provider_events" ADD CONSTRAINT "billing_provider_events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_provider_events" ADD CONSTRAINT "billing_provider_events_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "billing_provider_events_provider_key_unique" ON "billing_provider_events" USING btree ("provider","event_key");--> statement-breakpoint
CREATE INDEX "billing_provider_events_retry_idx" ON "billing_provider_events" USING btree ("status","next_attempt_at");