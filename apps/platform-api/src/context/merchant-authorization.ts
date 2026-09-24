import type { createPlatformDb } from "@ecs/db";
import { organizationMembers, organizationRoles, tenants, users } from "@ecs/db";
import { and, eq, inArray } from "drizzle-orm";

import {
  type MerchantPermissionRequest,
  type MerchantRole,
  merchantAccessControl,
  merchantPermissionStatement,
  merchantRoles,
} from "./merchant-permissions.js";

type PlatformDb = ReturnType<typeof createPlatformDb>["db"];

const builtInRoleNames = new Set<string>(Object.keys(merchantRoles));

export const merchantCapabilityRequests = {
  billing: { billing: ["read"] },
  customers: { customers: ["read"] },
  domains: { domains: ["manage"] },
  editor: { storefront: ["edit"] },
  inquiries: { inquiries: ["read"] },
  insights: { insights: ["read"] },
  media: { media: ["read"] },
  notifications: { notifications: ["read"] },
  orders: { orders: ["read"] },
  payments: { payments: ["manage"] },
  products: { products: ["read"] },
  promotions: { promotions: ["read"] },
  settings: { settings: ["read"] },
  storefront: { storefront: ["read"] },
  team: { team: ["read"] },
} as const satisfies Record<string, MerchantPermissionRequest>;

export type MerchantCapability = keyof typeof merchantCapabilityRequests;
export type MerchantPermissionGrant = `${keyof MerchantPermissionRequest}.${string}`;

function parseMemberRoles(value: string): string[] {
  return [
    ...new Set(
      value
        .split(",")
        .map((role) => role.trim())
        .filter(Boolean),
    ),
  ];
}

function parseCustomPermissions(value: string): MerchantPermissionRequest | null {
  try {
    const permission = JSON.parse(value) as unknown;
    if (!permission || typeof permission !== "object" || Array.isArray(permission)) return null;
    return permission as MerchantPermissionRequest;
  } catch {
    return null;
  }
}

function roleAllows(permission: MerchantPermissionRequest, request: MerchantPermissionRequest) {
  try {
    return merchantAccessControl.newRole(permission).authorize(request).success;
  } catch {
    return false;
  }
}

export function builtInMerchantRoleAllows(
  role: MerchantRole,
  request: MerchantPermissionRequest,
): boolean {
  return merchantRoles[role].authorize(request).success;
}

/**
 * Resolves Better Auth's built-in and dynamic organization roles. Memberships may
 * contain multiple comma-separated roles; a permission is granted when any one
 * role grants the complete request. Invalid or missing custom-role data fails closed.
 */
export function createMerchantPermissionLookup(db: PlatformDb) {
  return async function hasMerchantPermission(input: {
    organizationId: string;
    role: string;
    permission: MerchantPermissionRequest;
  }): Promise<boolean> {
    const roles = parseMemberRoles(input.role);

    for (const role of roles) {
      if (
        builtInRoleNames.has(role) &&
        builtInMerchantRoleAllows(role as MerchantRole, input.permission)
      ) {
        return true;
      }
    }

    const customRoleNames = roles.filter((role) => !builtInRoleNames.has(role));
    if (!customRoleNames.length) return false;

    const customRoles = await db
      .select({ permission: organizationRoles.permission })
      .from(organizationRoles)
      .where(
        and(
          eq(organizationRoles.organizationId, input.organizationId),
          inArray(organizationRoles.role, customRoleNames),
        ),
      );

    return customRoles.some((role) => {
      const permission = parseCustomPermissions(role.permission);
      return permission ? roleAllows(permission, input.permission) : false;
    });
  };
}

export function getBuiltInMerchantCapabilities(role: MerchantRole): MerchantCapability[] {
  return (
    Object.entries(merchantCapabilityRequests) as Array<
      [MerchantCapability, MerchantPermissionRequest]
    >
  )
    .filter(([, request]) => builtInMerchantRoleAllows(role, request))
    .map(([capability]) => capability);
}

export function getBuiltInMerchantPermissions(role: MerchantRole): MerchantPermissionGrant[] {
  return Object.entries(merchantPermissionStatement).flatMap(([resource, actions]) =>
    actions.flatMap((action) =>
      builtInMerchantRoleAllows(role, { [resource]: [action] } as MerchantPermissionRequest)
        ? ([`${resource}.${action}`] as MerchantPermissionGrant[])
        : [],
    ),
  );
}

export function createMerchantCapabilityLookup(db: PlatformDb) {
  return async function getMerchantCapabilities(input: {
    tenantId: string;
    userId: string;
  }): Promise<{ capabilities: MerchantCapability[]; permissions: MerchantPermissionGrant[] }> {
    const [member] = await db
      .select({
        organizationId: organizationMembers.organizationId,
        role: organizationMembers.role,
      })
      .from(organizationMembers)
      .innerJoin(tenants, eq(tenants.organizationId, organizationMembers.organizationId))
      .innerJoin(users, eq(users.id, organizationMembers.userId))
      .where(
        and(
          eq(tenants.id, input.tenantId),
          eq(organizationMembers.userId, input.userId),
          eq(organizationMembers.status, "active"),
          eq(users.status, "active"),
        ),
      )
      .limit(1);
    if (!member) return { capabilities: [], permissions: [] };

    const memberRoles = parseMemberRoles(member.role);
    const dynamicNames = memberRoles.filter((role) => !builtInRoleNames.has(role));
    const dynamicRoles = dynamicNames.length
      ? await db
          .select({ permission: organizationRoles.permission, role: organizationRoles.role })
          .from(organizationRoles)
          .where(
            and(
              eq(organizationRoles.organizationId, member.organizationId),
              inArray(organizationRoles.role, dynamicNames),
            ),
          )
      : [];
    const permissionSets = [
      ...memberRoles
        .filter((role): role is MerchantRole => builtInRoleNames.has(role))
        .map((role) => merchantRoles[role]),
      ...dynamicRoles.flatMap((role) => {
        const permission = parseCustomPermissions(role.permission);
        return permission ? [merchantAccessControl.newRole(permission)] : [];
      }),
    ];

    const capabilities = (
      Object.entries(merchantCapabilityRequests) as Array<
        [MerchantCapability, MerchantPermissionRequest]
      >
    )
      .filter(([, request]) =>
        permissionSets.some((permission) => permission.authorize(request).success),
      )
      .map(([capability]) => capability);

    const permissions = Object.entries(merchantPermissionStatement).flatMap(([resource, actions]) =>
      actions.flatMap((action) =>
        permissionSets.some(
          (permission) =>
            permission.authorize({ [resource]: [action] } as MerchantPermissionRequest).success,
        )
          ? ([`${resource}.${action}`] as MerchantPermissionGrant[])
          : [],
      ),
    );

    return { capabilities, permissions };
  };
}
