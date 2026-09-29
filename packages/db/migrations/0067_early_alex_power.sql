CREATE TABLE "merchant_mutation_locks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"resource_key" text NOT NULL,
	"operation" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "merchant_mutation_lock_tenant_resource_uidx" ON "merchant_mutation_locks" USING btree ("tenant_id","resource_key");--> statement-breakpoint
CREATE INDEX "merchant_mutation_lock_tenant_key_idx" ON "merchant_mutation_locks" USING btree ("tenant_id","operation","idempotency_key");