ALTER TABLE "domains" DROP CONSTRAINT "domains_hostname_unique";--> statement-breakpoint
ALTER TABLE "domains" ADD COLUMN "removed_at" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "domains_live_hostname_unique" ON "domains" USING btree ("hostname") WHERE "domains"."removed_at" is null;