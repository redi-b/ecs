import type { MerchantPermission } from "@ecs/contracts";

export type AccessRequirement =
  | { allOf: readonly MerchantPermission[] }
  | { anyOf: readonly MerchantPermission[] };

export const merchantPolicies = {
  overview: { anyOf: ["overview.read"] },
  products: { anyOf: ["products.read"] },
  productCreate: { anyOf: ["products.create"] },
  productUpdate: { anyOf: ["products.update"] },
  productDelete: { anyOf: ["products.delete"] },
  orders: { anyOf: ["orders.read"] },
  orderCreate: { anyOf: ["orders.create"] },
  customers: { anyOf: ["customers.read"] },
  customerUpdate: { anyOf: ["customers.update"] },
  inquiries: { anyOf: ["inquiries.read"] },
  inquiryUpdate: { anyOf: ["inquiries.update"] },
  promotions: { anyOf: ["promotions.read"] },
  promotionManage: { anyOf: ["promotions.manage"] },
  media: { anyOf: ["media.read"] },
  mediaManage: { anyOf: ["media.manage"] },
  storefront: { anyOf: ["storefront.read"] },
  storefrontEdit: { anyOf: ["storefront.edit"] },
  storefrontPublish: { anyOf: ["storefront.publish"] },
  insights: { anyOf: ["insights.read"] },
  billing: { anyOf: ["billing.read"] },
  shopSettings: { anyOf: ["settings.read"] },
  shopSettingsManage: { anyOf: ["settings.manage"] },
  team: { anyOf: ["team.read"] },
  notifications: { anyOf: ["notifications.read"] },
  notificationsManage: { anyOf: ["notifications.manage"] },
  paymentsManage: { anyOf: ["payments.manage"] },
  domainsManage: { anyOf: ["domains.manage"] },
  launchSetup: { anyOf: ["settings.manage", "storefront.publish"] },
  settings: { anyOf: [] },
} as const satisfies Record<string, AccessRequirement>;

export function allows(
  permissions: ReadonlySet<string> | readonly string[],
  requirement: AccessRequirement,
) {
  const available = permissions instanceof Set ? permissions : new Set(permissions);
  if ("allOf" in requirement) {
    return requirement.allOf.every((permission) => available.has(permission));
  }
  return (
    requirement.anyOf.length === 0 ||
    requirement.anyOf.some((permission) => available.has(permission))
  );
}
