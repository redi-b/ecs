ALTER TABLE "payment_onboarding" ADD COLUMN "online_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_onboarding" ADD COLUMN "credentials_validated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "payment_onboarding" ADD COLUMN "secret_fingerprint" text;