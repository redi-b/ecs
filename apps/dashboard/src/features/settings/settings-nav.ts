export type SettingsSectionId =
  | "shop"
  | "preferences"
  | "notifications"
  | "telegram"
  | "payments"
  | "fulfillment"
  | "storefront"
  | "account";

export const SETTINGS_SECTION_IDS: SettingsSectionId[] = [
  "shop",
  "preferences",
  "notifications",
  "telegram",
  "payments",
  "fulfillment",
  "storefront",
  "account",
];

/** @deprecated Prefer SETTINGS_SECTION_IDS + i18n labels in the UI. */
export const SETTINGS_SECTIONS: Array<{
  description: string;
  id: SettingsSectionId;
  label: string;
}> = [
  {
    id: "shop",
    label: "Shop",
    description: "Name, handle, and store URL",
  },
  {
    id: "preferences",
    label: "Preferences",
    description: "Workspace and shop defaults",
  },
  {
    id: "notifications",
    label: "Notifications",
    description: "Alerts for shop events",
  },
  {
    id: "telegram",
    label: "Telegram",
    description: "Run the shop from chat",
  },
  {
    id: "payments",
    label: "Payments",
    description: "How customers pay",
  },
  {
    id: "fulfillment",
    label: "Fulfillment",
    description: "Delivery, pickup, and fees",
  },
  {
    id: "storefront",
    label: "Storefront",
    description: "Template and live status",
  },
  {
    id: "account",
    label: "Account",
    description: "Profile, password, sessions",
  },
];

export function parseSettingsSection(value: string | undefined): SettingsSectionId {
  if (
    value === "shop" ||
    value === "preferences" ||
    value === "notifications" ||
    value === "telegram" ||
    value === "payments" ||
    value === "fulfillment" ||
    value === "storefront" ||
    value === "account"
  ) {
    return value;
  }
  if (value === "security") return "account";
  return "shop";
}
