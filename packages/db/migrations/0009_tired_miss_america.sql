CREATE TYPE "public"."media_access_mode" AS ENUM('public', 'private');--> statement-breakpoint
CREATE TYPE "public"."media_asset_status" AS ENUM('pending', 'uploaded', 'processing', 'ready', 'failed', 'deleted');--> statement-breakpoint
CREATE TYPE "public"."media_usage_resource_type" AS ENUM('product', 'editor', 'settings', 'collection', 'category', 'other');--> statement-breakpoint
CREATE TABLE "media_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"storage_provider" text NOT NULL,
	"bucket" text NOT NULL,
	"object_key" text NOT NULL,
	"filename" text NOT NULL,
	"display_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"byte_size" bigint NOT NULL,
	"width" integer,
	"height" integer,
	"access_mode" "media_access_mode" DEFAULT 'public' NOT NULL,
	"public_url" text,
	"status" "media_asset_status" DEFAULT 'pending' NOT NULL,
	"alt_text" text,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "media_usages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"media_asset_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"resource_type" "media_usage_resource_type" NOT NULL,
	"resource_id" text NOT NULL,
	"field" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_usages" ADD CONSTRAINT "media_usages_media_asset_id_media_assets_id_fk" FOREIGN KEY ("media_asset_id") REFERENCES "public"."media_assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_usages" ADD CONSTRAINT "media_usages_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "media_assets_tenant_created_at_idx" ON "media_assets" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX "media_assets_tenant_status_idx" ON "media_assets" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "media_assets_tenant_mime_type_idx" ON "media_assets" USING btree ("tenant_id","mime_type");--> statement-breakpoint
CREATE INDEX "media_assets_tenant_access_mode_idx" ON "media_assets" USING btree ("tenant_id","access_mode");--> statement-breakpoint
CREATE UNIQUE INDEX "media_assets_tenant_object_key_unique" ON "media_assets" USING btree ("tenant_id","object_key");--> statement-breakpoint
CREATE INDEX "media_usages_tenant_resource_idx" ON "media_usages" USING btree ("tenant_id","resource_type","resource_id");--> statement-breakpoint
CREATE INDEX "media_usages_asset_id_idx" ON "media_usages" USING btree ("media_asset_id");--> statement-breakpoint
CREATE INDEX "media_usages_resource_position_idx" ON "media_usages" USING btree ("tenant_id","resource_type","resource_id","field","position");