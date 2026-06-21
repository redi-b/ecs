import { pgEnum } from "drizzle-orm/pg-core";

export const tenantStatus = pgEnum("tenant_status", ["draft", "active", "suspended", "cancelled"]);

export const membershipRole = pgEnum("membership_role", ["owner", "manager", "staff", "operator"]);

export const subscriptionStatus = pgEnum("subscription_status", [
  "trialing",
  "active",
  "past_due",
  "paused",
  "cancelled",
]);

export const templateStatus = pgEnum("template_status", [
  "draft",
  "active",
  "deprecated",
  "disabled",
]);

export const notificationStatus = pgEnum("notification_status", [
  "pending",
  "sent",
  "failed",
  "retrying",
]);

export const analyticsSource = pgEnum("analytics_source", ["medusa", "platform", "storefront"]);
