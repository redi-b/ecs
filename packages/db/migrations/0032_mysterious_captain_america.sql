CREATE TABLE "product_import_executions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"artifact_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"requested_by_user_id" text NOT NULL,
	"content_digest" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"status" text DEFAULT 'pending_enqueue' NOT NULL,
	"job_run_id" uuid,
	"cursor" integer DEFAULT 0 NOT NULL,
	"total_products" integer NOT NULL,
	"succeeded_products" integer DEFAULT 0 NOT NULL,
	"failed_products" integer DEFAULT 0 NOT NULL,
	"error" text,
	"queued_at" timestamp with time zone,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_import_outcomes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"execution_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"product_key" text NOT NULL,
	"source_rows" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"product_id" text,
	"error_code" text,
	"error_message" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "product_import_executions" ADD CONSTRAINT "product_import_executions_artifact_id_product_import_artifacts_id_fk" FOREIGN KEY ("artifact_id") REFERENCES "public"."product_import_artifacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_import_executions" ADD CONSTRAINT "product_import_executions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_import_outcomes" ADD CONSTRAINT "product_import_outcomes_execution_id_product_import_executions_id_fk" FOREIGN KEY ("execution_id") REFERENCES "public"."product_import_executions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_import_outcomes" ADD CONSTRAINT "product_import_outcomes_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "product_import_executions_tenant_idempotency_uidx" ON "product_import_executions" USING btree ("tenant_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "product_import_executions_tenant_created_idx" ON "product_import_executions" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX "product_import_executions_status_updated_idx" ON "product_import_executions" USING btree ("status","updated_at");--> statement-breakpoint
CREATE INDEX "product_import_executions_artifact_idx" ON "product_import_executions" USING btree ("artifact_id");--> statement-breakpoint
CREATE UNIQUE INDEX "product_import_outcomes_execution_product_uidx" ON "product_import_outcomes" USING btree ("execution_id","product_key");--> statement-breakpoint
CREATE INDEX "product_import_outcomes_execution_status_idx" ON "product_import_outcomes" USING btree ("execution_id","status");--> statement-breakpoint
CREATE INDEX "product_import_outcomes_tenant_created_idx" ON "product_import_outcomes" USING btree ("tenant_id","created_at");