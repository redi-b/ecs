CREATE TABLE "platform_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"storage_provider" text NOT NULL,
	"bucket" text NOT NULL,
	"object_key" text NOT NULL,
	"filename" text NOT NULL,
	"mime_type" text NOT NULL,
	"byte_size" bigint NOT NULL,
	"width" integer,
	"height" integer,
	"public_url" text,
	"status" "media_asset_status" DEFAULT 'pending' NOT NULL,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "storefront_template_versions" ADD COLUMN "preview_asset_id" uuid;--> statement-breakpoint
ALTER TABLE "storefront_template_versions" ADD COLUMN "preview_alt_text" text;--> statement-breakpoint
ALTER TABLE "storefront_template_versions" ADD COLUMN "demo_url" text;--> statement-breakpoint
ALTER TABLE "platform_assets" ADD CONSTRAINT "platform_assets_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "platform_assets_object_key_unique" ON "platform_assets" USING btree ("object_key");--> statement-breakpoint
ALTER TABLE "storefront_template_versions" ADD CONSTRAINT "storefront_template_versions_preview_asset_id_platform_assets_id_fk" FOREIGN KEY ("preview_asset_id") REFERENCES "public"."platform_assets"("id") ON DELETE no action ON UPDATE no action;