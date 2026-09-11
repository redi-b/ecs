CREATE TABLE "organization_invitations" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"email" text NOT NULL,
	"role" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"inviter_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_members" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text DEFAULT 'staff' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_roles" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"role" text NOT NULL,
	"permission" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"logo" text,
	"metadata" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "active_organization_id" text;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "organization_id" text;--> statement-breakpoint
INSERT INTO "organizations" ("id", "name", "slug", "created_at")
SELECT 'org_' || replace("id"::text, '-', ''), "name", "handle", "created_at"
FROM "tenants"
ON CONFLICT DO NOTHING;--> statement-breakpoint
UPDATE "tenants"
SET "organization_id" = 'org_' || replace("id"::text, '-', '')
WHERE "organization_id" IS NULL;--> statement-breakpoint
INSERT INTO "organization_members" ("id", "organization_id", "user_id", "role", "status")
SELECT DISTINCT ON (tm."tenant_id", tm."user_id")
	'member_' || replace(tm."id"::text, '-', ''),
	'org_' || replace(tm."tenant_id"::text, '-', ''),
	tm."user_id",
	CASE WHEN tm."role" = 'operator' THEN 'staff' ELSE tm."role"::text END,
	tm."status"
FROM "tenant_memberships" tm
ORDER BY
	tm."tenant_id",
	tm."user_id",
	CASE WHEN tm."status" = 'active' THEN 0 ELSE 1 END,
	CASE WHEN tm."role" = 'owner' THEN 0 ELSE 1 END,
	tm."id"
ON CONFLICT DO NOTHING;--> statement-breakpoint
DO $$
BEGIN
	IF EXISTS (
		SELECT 1
		FROM "tenants" t
		LEFT JOIN "organization_members" om
			ON om."organization_id" = t."organization_id"
			AND position(',owner,' in ',' || replace(om."role", ' ', '') || ',') > 0
			AND om."status" = 'active'
		WHERE om."id" IS NULL
	) THEN
		RAISE EXCEPTION 'organization migration aborted: every tenant must have an active owner';
	END IF;
END $$;--> statement-breakpoint
ALTER TABLE "tenants" ALTER COLUMN "organization_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "organization_invitations" ADD CONSTRAINT "organization_invitations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_invitations" ADD CONSTRAINT "organization_invitations_inviter_id_users_id_fk" FOREIGN KEY ("inviter_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_roles" ADD CONSTRAINT "organization_roles_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "organization_invitations_organization_id_idx" ON "organization_invitations" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "organization_invitations_email_idx" ON "organization_invitations" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "organization_members_org_user_uidx" ON "organization_members" USING btree ("organization_id","user_id");--> statement-breakpoint
CREATE INDEX "organization_members_user_id_idx" ON "organization_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "organization_members_organization_id_idx" ON "organization_members" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "organization_roles_org_role_uidx" ON "organization_roles" USING btree ("organization_id","role");--> statement-breakpoint
CREATE INDEX "organization_roles_organization_id_idx" ON "organization_roles" USING btree ("organization_id");--> statement-breakpoint
ALTER TABLE "organization_roles" ADD CONSTRAINT "organization_roles_no_owner_only_permissions" CHECK (NOT (coalesce("permission"::jsonb -> 'ownership', '[]'::jsonb) @> '["transfer"]'::jsonb));--> statement-breakpoint
CREATE UNIQUE INDEX "organizations_slug_uidx" ON "organizations" USING btree ("slug");--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_active_organization_id_organizations_id_fk" FOREIGN KEY ("active_organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_organization_id_unique" UNIQUE("organization_id");--> statement-breakpoint
CREATE OR REPLACE FUNCTION "enforce_organization_active_owner"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
	organization_to_check text;
BEGIN
	FOR organization_to_check IN
		SELECT DISTINCT candidate
		FROM unnest(ARRAY[
			CASE WHEN TG_OP <> 'INSERT' THEN OLD."organization_id" END,
			CASE WHEN TG_OP <> 'DELETE' THEN NEW."organization_id" END
		]) AS candidate
		WHERE candidate IS NOT NULL
	LOOP
		IF EXISTS (
			SELECT 1 FROM "tenants" WHERE "organization_id" = organization_to_check
		) AND NOT EXISTS (
			SELECT 1
			FROM "organization_members"
			WHERE "organization_id" = organization_to_check
				AND "status" = 'active'
				AND position(',owner,' in ',' || replace("role", ' ', '') || ',') > 0
		) THEN
			RAISE EXCEPTION 'organization % must retain an active owner', organization_to_check
				USING ERRCODE = '23514';
		END IF;
	END LOOP;
	RETURN NULL;
END;
$$;--> statement-breakpoint
CREATE CONSTRAINT TRIGGER "organization_members_active_owner_guard"
AFTER INSERT OR UPDATE OR DELETE ON "organization_members"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION "enforce_organization_active_owner"();
