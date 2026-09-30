CREATE TABLE "merchant_mutation_executions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"operation" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"payload_hash" text NOT NULL,
	"actor_user_id" text NOT NULL,
	"source" text NOT NULL,
	"request_id" text NOT NULL,
	"state" text DEFAULT 'processing' NOT NULL,
	"result" jsonb,
	"failure_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "merchant_mutation_tenant_operation_key_uidx" ON "merchant_mutation_executions" USING btree ("tenant_id","operation","idempotency_key");--> statement-breakpoint
CREATE INDEX "merchant_mutation_tenant_state_idx" ON "merchant_mutation_executions" USING btree ("tenant_id","state");