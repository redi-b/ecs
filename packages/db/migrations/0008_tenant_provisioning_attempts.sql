CREATE TABLE "tenant_provisioning_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid,
	"platform_tenant_id" uuid NOT NULL,
	"handle" text NOT NULL,
	"owner_user_id" text NOT NULL,
	"step" text NOT NULL,
	"status" text NOT NULL,
	"error" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "tenant_provisioning_attempts" ADD CONSTRAINT "tenant_provisioning_attempts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tenant_provisioning_attempts_tenant_id_created_at_idx" ON "tenant_provisioning_attempts" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX "tenant_provisioning_attempts_platform_tenant_id_idx" ON "tenant_provisioning_attempts" USING btree ("platform_tenant_id");--> statement-breakpoint
CREATE INDEX "tenant_provisioning_attempts_owner_handle_idx" ON "tenant_provisioning_attempts" USING btree ("owner_user_id","handle");