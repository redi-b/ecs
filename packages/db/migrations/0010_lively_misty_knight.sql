CREATE TYPE "public"."job_run_status" AS ENUM('queued', 'active', 'completed', 'failed', 'cancelled');--> statement-breakpoint
CREATE TABLE "job_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid,
	"name" text NOT NULL,
	"status" "job_run_status" DEFAULT 'queued' NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"result" jsonb,
	"error" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 3 NOT NULL,
	"idempotency_key" text,
	"bullmq_job_id" text,
	"queued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "job_runs" ADD CONSTRAINT "job_runs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "job_runs_status_created_at_idx" ON "job_runs" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "job_runs_tenant_created_at_idx" ON "job_runs" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX "job_runs_name_created_at_idx" ON "job_runs" USING btree ("name","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "job_runs_name_idempotency_key_uidx" ON "job_runs" USING btree ("name","idempotency_key") WHERE "job_runs"."idempotency_key" is not null;