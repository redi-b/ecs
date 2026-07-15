import type { AppIcon } from "@/components/app/icons";
import { AppIcons } from "@/components/app/icons";
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

/** Verb-first actions that navigate to existing create/list UIs. */
export const commandActions: CommandDef[] = [
  {
    id: "action.create-product",
    label: "Create product",
    keywords: ["new", "add", "catalog", "item"],
    group: "action",
    icon: AppIcons.products,
    href: dashboardRoutes.products,
  },
  {
    id: "action.create-category",
    label: "Create category",
    keywords: ["new", "taxonomy", "catalog"],
    group: "action",
    icon: AppIcons.tree,
    href: dashboardRoutes.productCategoriesNew,
  },
  {
    id: "action.create-collection",
    label: "Create collection",
    keywords: ["new", "taxonomy", "catalog"],
    group: "action",
    icon: AppIcons.folder,
    href: dashboardRoutes.productCollectionsNew,
  },
  {
    id: "action.create-order",
    label: "Create manual order",
    keywords: ["new", "draft", "sale"],
    group: "action",
    icon: AppIcons.orders,
    href: dashboardRoutes.orders,
  },
  {
    id: "action.customers",
    label: "Open customers",
    keywords: ["buyers", "people", "contacts"],
    group: "action",
    icon: AppIcons.user,
    href: dashboardRoutes.customers,
  },
  {
    id: "action.upload-media",
    label: "Upload media",
    keywords: ["image", "file", "library"],
    group: "action",
    icon: AppIcons.image,
    href: dashboardRoutes.media,
  },
  {
    id: "action.promotions",
    label: "Open promotions",
    keywords: ["discount", "coupon", "code"],
    group: "action",
    icon: AppIcons.tag,
    href: dashboardRoutes.promotions,
  },
  {
    id: "action.billing",
    label: "Open billing",
    keywords: ["plan", "subscription", "invoice", "pay"],
    group: "action",
    icon: AppIcons.billing,
    href: dashboardRoutes.billing,
  },
  {
    id: "action.settings",
    label: "Open settings",
    keywords: ["shop", "account", "preferences"],
    group: "action",
    icon: AppIcons.settings,
    href: dashboardRoutes.settings,
  },
];

export function getNavigationCommands(): CommandDef[] {
  return getNavigableAppRoutes()
    .filter((route) => !route.disabled)
    .map((route) => ({
      id: `nav.${route.id}`,
      label: route.title,
      keywords: route.keywords,
      group: "navigation" as const,
      icon: route.icon,
      href: route.href,
    }));
}

export function getAllStaticCommands(): CommandDef[] {
  return [...commandActions, ...getNavigationCommands()];
}

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
