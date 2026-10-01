export type SettingsSectionId =
  | "shop"
  | "documents"
  | "preferences"
  | "notifications"
  | "team"
  | "telegram"
  | "payments"
  | "fulfillment"
  | "storefront"
  | "domains"
  | "account";

export const SETTINGS_SECTION_IDS: SettingsSectionId[] = [
  "shop",
  "preferences",
  "notifications",
  "team",
  "telegram",
  "payments",
  "fulfillment",
  "storefront",
  "documents",
  "domains",
  "account",
];

export type SettingsGroupId = "shop" | "selling" | "team" | "account";
const SETTINGS_GROUPS: Array<{ id: SettingsGroupId; sections: SettingsSectionId[] }> = [
  { id: "shop", sections: ["shop", "storefront", "domains"] },
  { id: "selling", sections: ["payments", "fulfillment", "documents"] },
  { id: "team", sections: ["team", "notifications", "telegram"] },
  { id: "account", sections: ["preferences", "account"] },
];

/** Registry-owned order, permission-owned visibility; never show empty groups. */
export function groupSettingsSections(visibleSections: readonly SettingsSectionId[]) {
  const visible = new Set(visibleSections);
  return SETTINGS_GROUPS.map((group) => ({
    ...group,
    sections: group.sections.filter((id) => visible.has(id)),
  })).filter((group) => group.sections.length > 0);
}

/** @deprecated Prefer SETTINGS_SECTION_IDS + i18n labels in the UI. */
export const SETTINGS_SECTIONS: Array<{
  description: string;
  id: SettingsSectionId;
  label: string;
}> = [
  {
    id: "team",
    label: "Team",
    description: "Members, invitations, and roles",
  },
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
    id: "documents",
    label: "Documents",
    description: "Branding for printable documents",
  },
  {
    id: "domains",
    label: "Domains",
    description: "Custom address and DNS setup",
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
    value === "documents" ||
    value === "preferences" ||
    value === "notifications" ||
    value === "team" ||
    value === "telegram" ||
    value === "payments" ||
    value === "fulfillment" ||
    value === "storefront" ||
    value === "domains" ||
    value === "account"
  ) {
    return value;
  }
  if (value === "security") return "account";
  return "shop";
}

const TASK_TERMS: Record<SettingsSectionId, string> = {
  shop: "name handle phone email address location landmark category description ስም ስልክ አድራሻ አካባቢ",
  storefront: "template theme design publish live language seo google search engine ንድፍ ቋንቋ",
  domains: "dns cname hostname website custom domain www url ዶሜይን",
  payments: "telebirr chapa cbe bank transfer cash customer payment ክፍያ ባንክ ቴሌብር",
  fulfillment: "delivery fee shipping pickup collection courier city rate ማድረስ መላኪያ ማጓጓዣ",
  documents: "receipt invoice quotation packing slip logo branding pdf print ደረሰኝ ሰነድ አርማ",
  team: "staff employee cashier invite invitation member role access permission ቡድን ሰራተኛ ፈቃድ",
  notifications: "alert event email message order notification ማሳወቂያ መልእክት",
  telegram: "bot telegram chat connect channel ቴሌግራም ቦት",
  preferences: "theme dark light appearance workspace default setup assistant ገጽታ ጨለማ ምርጫ",
  account:
    "reset change password login security profile session sign out devices የይለፍ ቃል ይለፍ መለያ ደህንነት",
};

/** Permission-filtered task search, in either language regardless of UI locale. */
export function searchSettingsSections(
  query: string,
  visibleSections: readonly SettingsSectionId[],
  translate: (key: `settings.sections.${SettingsSectionId}.${"label" | "description"}`) => string,
): SettingsSectionId[] {
  const normalize = (value: string) => value.normalize("NFKC").toLocaleLowerCase().trim();
  const words = normalize(query).split(/\s+/).filter(Boolean);
  if (!words.length) return [...visibleSections];
  return visibleSections.filter((id) => {
    const text = normalize(
      `${translate(`settings.sections.${id}.label`)} ${translate(`settings.sections.${id}.description`)} ${TASK_TERMS[id]}`,
    );
    return words.every((word) => text.includes(word));
  });
}
