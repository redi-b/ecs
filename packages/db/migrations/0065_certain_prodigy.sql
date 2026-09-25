CREATE TABLE "tenant_provisioning_claims" (
	"handle" text PRIMARY KEY NOT NULL,
	"claim_token" uuid NOT NULL,
	"owner_user_id" text NOT NULL,
	"platform_tenant_id" uuid NOT NULL,
	"lease_expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
