CREATE TABLE "platform_permission_grants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"principal_id" uuid NOT NULL,
	"permission" text NOT NULL,
	"granted_by_user_id" text,
	"expires_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_principals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "platform_permission_grants" ADD CONSTRAINT "platform_permission_grants_principal_id_platform_principals_id_fk" FOREIGN KEY ("principal_id") REFERENCES "public"."platform_principals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_permission_grants" ADD CONSTRAINT "platform_permission_grants_granted_by_user_id_users_id_fk" FOREIGN KEY ("granted_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_principals" ADD CONSTRAINT "platform_principals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "platform_permission_grants_principal_permission_unique" ON "platform_permission_grants" USING btree ("principal_id","permission");--> statement-breakpoint
CREATE INDEX "platform_permission_grants_principal_idx" ON "platform_permission_grants" USING btree ("principal_id");--> statement-breakpoint
CREATE UNIQUE INDEX "platform_principals_user_id_unique" ON "platform_principals" USING btree ("user_id");