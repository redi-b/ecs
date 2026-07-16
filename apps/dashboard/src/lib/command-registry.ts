import type { AppIcon } from "@/components/app/icons";
import { AppIcons } from "@/components/app/icons";
import type { MessageKey } from "@/i18n/messages";
import { getNavigableAppRoutes } from "@/lib/navigation";
import { dashboardRoutes } from "@/lib/routes";

export type CommandGroup = "action" | "navigation";

export type CommandDef = {
  id: string;
  label: string;
  keywords: string[];
  group: CommandGroup;
  icon: AppIcon;
  href: string;
};

type Translate = (key: MessageKey) => string;

type ActionDef = {
  id: string;
  labelKey: MessageKey;
  keywords: string[];
  icon: AppIcon;
  href: string;
};

/** Verb-first actions that navigate to existing create/list UIs. */
/** Append create= deep-link so list pages open the create dialog. */
function withCreate(href: string, create: string) {
  const url = new URL(href, "http://local.invalid");
  url.searchParams.set("create", create);
  return `${url.pathname}${url.search}`;
}

const actionDefs: ActionDef[] = [
  {
    id: "action.create-product",
    labelKey: "commandCenter.actions.createProduct",
    keywords: ["new", "add", "catalog", "item", "product"],
    icon: AppIcons.products,
    href: withCreate(dashboardRoutes.products, "product"),
  },
  {
    id: "action.create-category",
    labelKey: "commandCenter.actions.createCategory",
    keywords: ["new", "taxonomy", "catalog", "category"],
    icon: AppIcons.tree,
    href: withCreate(dashboardRoutes.productCategories, "category"),
  },
  {
    id: "action.create-collection",
    labelKey: "commandCenter.actions.createCollection",
    keywords: ["new", "taxonomy", "catalog", "collection"],
    icon: AppIcons.folder,
    href: withCreate(dashboardRoutes.productCollections, "collection"),
  },
  {
    id: "action.create-order",
    labelKey: "commandCenter.actions.createOrder",
    keywords: ["new", "draft", "sale", "order"],
    icon: AppIcons.orders,
    href: withCreate(dashboardRoutes.orders, "order"),
  },
  {
    id: "action.customers",
    labelKey: "commandCenter.actions.openCustomers",
    keywords: ["buyers", "people", "contacts", "customers"],
    icon: AppIcons.user,
    href: dashboardRoutes.customers,
  },
  {
    id: "action.upload-media",
    labelKey: "commandCenter.actions.uploadMedia",
    keywords: ["image", "file", "library", "media", "upload"],
    icon: AppIcons.image,
    href: dashboardRoutes.media,
  },
  {
    id: "action.create-promotion",
    labelKey: "commandCenter.actions.createPromotion",
    keywords: ["new", "discount", "coupon", "code", "promotion"],
    icon: AppIcons.tag,
    href: withCreate(dashboardRoutes.promotions, "promotion"),
  },
  {
    id: "action.billing",
    labelKey: "commandCenter.actions.openBilling",
    keywords: ["plan", "subscription", "invoice", "pay", "billing"],
    icon: AppIcons.billing,
    href: dashboardRoutes.billing,
  },
  {
    id: "action.settings",
    labelKey: "commandCenter.actions.openSettings",
    keywords: ["shop", "account", "preferences", "settings"],
    icon: AppIcons.settings,
    href: dashboardRoutes.settings,
  },
];

/** Map route ids (kebab) to `nav.*` message keys (camelCase). */
export function navMessageKeyForRouteId(id: string): MessageKey {
  const camelCased = id.replace(/-([a-z])/g, (_, letter: string | undefined) =>
    letter ? letter.toUpperCase() : "",
  );
  return `nav.${camelCased}` as MessageKey;
}

export function getCommandActions(t: Translate): CommandDef[] {
  return actionDefs.map((def) => ({
    id: def.id,
    label: t(def.labelKey),
    keywords: def.keywords,
    group: "action" as const,
    icon: def.icon,
    href: def.href,
  }));
}

export function getNavigationCommands(t: Translate): CommandDef[] {
  return getNavigableAppRoutes()
    .filter((route) => !route.disabled)
    .map((route) => ({
      id: `nav.${route.id}`,
      label: t(navMessageKeyForRouteId(route.id)) || route.title,
      keywords: route.keywords,
      group: "navigation" as const,
      icon: route.icon,
      href: route.href,
    }));
}

export function getAllStaticCommands(t: Translate): CommandDef[] {
  return [...getCommandActions(t), ...getNavigationCommands(t)];
}

/** @deprecated Prefer getCommandActions(t). English-only fallback for tests. */
export const commandActions: CommandDef[] = actionDefs.map((def) => ({
  id: def.id,
  label: def.labelKey.split(".").pop() ?? def.id,
  keywords: def.keywords,
  group: "action" as const,
  icon: def.icon,
  href: def.href,
}));

export function filterStaticCommands(query: string, commands: CommandDef[]): CommandDef[] {
  const q = query.trim().toLowerCase();
  if (!q) return commands;

  return commands.filter((command) => {
    const haystack = [command.label, ...command.keywords].join(" ").toLowerCase();
    return haystack.includes(q);
  });
}

export function commandSearchValue(command: CommandDef): string {
  return [command.label, ...command.keywords, command.group].join(" ");
}
