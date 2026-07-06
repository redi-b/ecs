import { jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { tenants } from "./tenants.js";

export const tenantOnboarding = pgTable(
  "tenant_onboarding",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    status: text("status").notNull().default("in_progress"),
    currentStep: text("current_step").notNull().default("storefront_review"),
    completedSteps: jsonb("completed_steps").notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("tenant_onboarding_tenant_id_unique").on(table.tenantId)],
);
