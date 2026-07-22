import {
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { tenants } from "./tenants.js";

/**
 * Merchant destination accounts for offline settlement labels / export.
 * Not used on storefront checkout (Chapa owns online rails).
 */
export const merchantReceivingAccounts = pgTable(
  "merchant_receiving_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    /** Chapa bank code or wallet key (telebirr, cash not used here). */
    bankCode: text("bank_code"),
    bankName: text("bank_name").notNull(),
    accountName: text("account_name"),
    /** Encrypted full account number when provided. */
    accountNumberEncrypted: text("account_number_encrypted"),
    accountLast4: text("account_last4"),
    label: text("label").notNull(),
    isDefault: boolean("is_default").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("merchant_receiving_accounts_tenant_idx").on(table.tenantId),
    uniqueIndex("merchant_receiving_accounts_tenant_label_uidx").on(table.tenantId, table.label),
  ],
);
