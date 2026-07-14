export type SettingsSectionId =
  | "shop"
  | "preferences"
  | "notifications"
  | "fulfillment"
  | "storefront"
  | "account";

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
    description: "Email and Telegram alerts",
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
    value === "fulfillment" ||
    value === "storefront" ||
    value === "account"
  ) {
    return value;
  }
  if (value === "security") return "account";
  return "shop";
}
