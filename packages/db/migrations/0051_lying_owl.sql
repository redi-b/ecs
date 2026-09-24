ALTER TABLE "in_app_notifications" DROP CONSTRAINT "in_app_notifications_tenant_id_tenants_id_fk";
--> statement-breakpoint
ALTER TABLE "in_app_notifications" ADD CONSTRAINT "in_app_notifications_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
