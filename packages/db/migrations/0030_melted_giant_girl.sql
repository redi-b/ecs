CREATE TABLE "tenant_support_access_grants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"platform_principal_id" uuid NOT NULL,
	"operator_user_id" text NOT NULL,
	"reason" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"revoked_by_user_id" text,
	"revoke_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tenant_support_access_grants" ADD CONSTRAINT "tenant_support_access_grants_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_support_access_grants" ADD CONSTRAINT "tenant_support_access_grants_platform_principal_id_platform_principals_id_fk" FOREIGN KEY ("platform_principal_id") REFERENCES "public"."platform_principals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_support_access_grants" ADD CONSTRAINT "tenant_support_access_grants_operator_user_id_users_id_fk" FOREIGN KEY ("operator_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_support_access_grants" ADD CONSTRAINT "tenant_support_access_grants_revoked_by_user_id_users_id_fk" FOREIGN KEY ("revoked_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tenant_support_access_grants_tenant_created_idx" ON "tenant_support_access_grants" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX "tenant_support_access_grants_operator_expiry_idx" ON "tenant_support_access_grants" USING btree ("operator_user_id","expires_at");