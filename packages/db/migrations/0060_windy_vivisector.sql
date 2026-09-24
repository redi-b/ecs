ALTER TABLE "storefront_configs" ADD COLUMN "language_settings" jsonb DEFAULT '{"sourceLocale":"en","defaultLocale":"en","enabledLocales":["en"]}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "storefront_configs" ADD COLUMN "localized_content" jsonb DEFAULT '{"version":1,"locales":{}}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "storefront_revisions" ADD COLUMN "language_settings" jsonb DEFAULT '{"sourceLocale":"en","defaultLocale":"en","enabledLocales":["en"]}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "storefront_revisions" ADD COLUMN "localized_content" jsonb DEFAULT '{"version":1,"locales":{}}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "storefront_revisions" ADD COLUMN "seo_settings" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "storefront_template_drafts" ADD COLUMN "localized_content" jsonb DEFAULT '{"version":1,"locales":{}}'::jsonb NOT NULL;