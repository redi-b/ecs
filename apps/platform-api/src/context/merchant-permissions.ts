import { merchantPermissionActions } from "@ecs/contracts";
import { createAccessControl } from "better-auth/plugins/access";
import { defaultStatements } from "better-auth/plugins/organization/access";

export const merchantPermissionStatement = {
  ...defaultStatements,
  ...merchantPermissionActions,
} as const;

export const merchantAccessControl = createAccessControl(merchantPermissionStatement);

export const builtInMerchantRolePermissions = {
  owner: {
    organization: ["update", "delete"],
    member: ["create", "update", "delete"],
    invitation: ["create", "cancel"],
    team: ["create", "update", "delete", "read", "invite", "manage", "roles"],
    ac: ["create", "read", "update", "delete"],
    overview: ["read"],
    orders: ["read", "create", "update", "cancel", "refund", "export"],
    products: ["read", "create", "update", "publish", "delete", "import", "export"],
    customers: ["read", "update", "export"],
    inquiries: ["read", "update"],
    promotions: ["read", "manage"],
    media: ["read", "manage"],
    storefront: ["read", "edit", "publish"],
    insights: ["read"],
    notifications: ["read", "manage"],
    settings: ["read", "manage"],
    domains: ["manage"],
    payments: ["manage"],
    billing: ["read", "manage"],
    ownership: ["transfer"],
  },
  manager: {
    organization: ["update"],
    member: ["create", "update", "delete"],
    invitation: ["create", "cancel"],
    team: ["read", "invite", "manage"],
    ac: ["read"],
    overview: ["read"],
    orders: ["read", "create", "update", "cancel", "refund", "export"],
    products: ["read", "create", "update", "publish", "delete", "import", "export"],
    customers: ["read", "update", "export"],
    inquiries: ["read", "update"],
    promotions: ["read", "manage"],
    media: ["read", "manage"],
    storefront: ["read", "edit", "publish"],
    insights: ["read"],
    notifications: ["read", "manage"],
    settings: ["read", "manage"],
    domains: ["manage"],
    payments: ["manage"],
    billing: ["read"],
    ownership: [],
  },
  staff: {
    organization: [],
    member: [],
    invitation: [],
    team: [],
    ac: ["read"],
    overview: ["read"],
    orders: ["read", "create", "update"],
    products: ["read", "create", "update", "import", "export"],
    customers: ["read", "update"],
    inquiries: ["read", "update"],
    promotions: ["read"],
    media: ["read", "manage"],
    storefront: ["read", "edit"],
    insights: [],
    notifications: ["read"],
    settings: ["read"],
    domains: [],
    payments: [],
    billing: [],
    ownership: [],
  },
  viewer: {
    organization: [],
    member: [],
    invitation: [],
    team: [],
    ac: ["read"],
    overview: ["read"],
    orders: ["read"],
    products: ["read"],
    customers: ["read"],
    inquiries: ["read"],
    promotions: ["read"],
    media: ["read"],
    storefront: ["read"],
    insights: ["read"],
    notifications: ["read"],
    settings: ["read"],
    domains: [],
    payments: [],
    billing: ["read"],
    ownership: [],
  },
} as const;

export const merchantRoles = {
  owner: merchantAccessControl.newRole(builtInMerchantRolePermissions.owner),
  manager: merchantAccessControl.newRole(builtInMerchantRolePermissions.manager),
  staff: merchantAccessControl.newRole(builtInMerchantRolePermissions.staff),
  viewer: merchantAccessControl.newRole(builtInMerchantRolePermissions.viewer),
} as const;

export type MerchantRole = keyof typeof merchantRoles;
export type MerchantPermissionRequest = Partial<{
  [Resource in keyof typeof merchantPermissionStatement]: (typeof merchantPermissionStatement)[Resource][number][];
}>;

/**
 * Custom roles cannot usefully mutate a resource they cannot load. Keep this
 * invariant at the authorization seam, even when callers bypass the dashboard.
 */
export function normalizeMerchantRolePermissions(
  permission: MerchantPermissionRequest,
): MerchantPermissionRequest {
  return Object.fromEntries(
    Object.entries(permission).map(([resource, actions]) => {
      const allowed =
        merchantPermissionStatement[resource as keyof typeof merchantPermissionStatement];
      const grants = [...(actions ?? [])];
      if (grants.length > 0 && (allowed as readonly string[] | undefined)?.includes("read")) {
        grants.unshift("read");
      }
      return [resource, [...new Set(grants)]];
    }),
  ) as MerchantPermissionRequest;
}

export const protectedMerchantRoleNames = Object.freeze(
  Object.keys(merchantRoles) as MerchantRole[],
);
