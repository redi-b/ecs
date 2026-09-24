import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Platform-owned operational secrets (not merchant credentials).
 * Values are encrypted at rest by platform-api (AES-GCM).
 * Never expose decrypted values on public/merchant APIs.
 */
export const platformSystemSecrets = pgTable("platform_system_secrets", {
  key: text("key").primaryKey(),
  valueEncrypted: text("value_encrypted").notNull(),
  fingerprint: text("fingerprint"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
