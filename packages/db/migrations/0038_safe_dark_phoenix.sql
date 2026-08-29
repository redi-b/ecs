CREATE TABLE "capability_reservations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"key" text NOT NULL,
	"window_key" text NOT NULL,
	"amount" integer NOT NULL,
	"idempotency_key" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"committed_at" timestamp with time zone,
	"released_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "capability_reservations_amount_positive" CHECK ("capability_reservations"."amount" > 0),
	CONSTRAINT "capability_reservations_status_valid" CHECK ("capability_reservations"."status" in ('active', 'committed', 'released', 'expired'))
);
--> statement-breakpoint
CREATE TABLE "capability_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"key" text NOT NULL,
	"window_key" text NOT NULL,
	"consumed" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "capability_usage_consumed_nonnegative" CHECK ("capability_usage"."consumed" >= 0)
);
--> statement-breakpoint
ALTER TABLE "capability_reservations" ADD CONSTRAINT "capability_reservations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capability_usage" ADD CONSTRAINT "capability_usage_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "capability_reservations_idempotency_unique" ON "capability_reservations" USING btree ("tenant_id","key","window_key","idempotency_key");--> statement-breakpoint
CREATE INDEX "capability_reservations_active_scope_idx" ON "capability_reservations" USING btree ("tenant_id","key","window_key","status","expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "capability_usage_scope_unique" ON "capability_usage" USING btree ("tenant_id","key","window_key");