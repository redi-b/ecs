export type SettingsSectionId =
  | "shop"
  | "preferences"
  | "notifications"
  | "payments"
  | "fulfillment"
  | "storefront"
  | "account";

export const SETTINGS_SECTION_IDS: SettingsSectionId[] = [
  "shop",
  "preferences",
  "notifications",
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
    description: "Name, handle, and hostnames",
  },
  {
    id: "preferences",
    label: "Preferences",
    description: "Dashboard and checkout defaults",
  },
  {
    id: "notifications",
    label: "Notifications",
    description: "Orders, payments, and shop events",
  },
  {
    id: "payments",
    label: "Payments",
    description: "COD and online payments",
  },
  {
    id: "fulfillment",
    label: "Fulfillment",
    description: "Delivery, pickup, and fees",
  },
  {
    id: "storefront",
    label: "Storefront",
    description: "Template and publication",
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
