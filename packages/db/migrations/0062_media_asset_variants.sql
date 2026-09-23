ALTER TABLE "media_assets" ADD COLUMN "variants" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "media_assets" ADD COLUMN "variants_status" text DEFAULT 'pending' NOT NULL;
