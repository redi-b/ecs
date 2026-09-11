import type { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { z } from "zod";

import type { PlatformAppOptions, PlatformAppVariables } from "../../app.js";
import {
  builtInMerchantRolePermissions,
  merchantPermissionStatement,
  normalizeMerchantRolePermissions,
  protectedMerchantRoleNames,
} from "../../auth/merchant-permissions.js";
import type { MerchantRouteHelpers } from "./context.js";

const roleNameSchema = z
  .string()
  .trim()
  .min(2)
  .max(64)
  .regex(/^[a-z][a-z0-9_-]*$/, "Use lowercase letters, numbers, hyphens, or underscores");
const inviteSchema = z.object({
  email: z.string().trim().email().max(320),
  resend: z.boolean().optional(),
  role: roleNameSchema,
});
const memberRoleSchema = z.object({ role: roleNameSchema });
const memberStatusSchema = z.object({ status: z.enum(["active", "suspended"]) });
const permissionSchema = z
  .record(z.string(), z.array(z.string()).max(32))
  .superRefine((value, context) => {
    const restrictedResources = new Set([
      "ac",
      "invitation",
      "member",
      "organization",
      "ownership",
    ]);
    for (const [resource, actions] of Object.entries(value)) {
      const allowed =
        merchantPermissionStatement[resource as keyof typeof merchantPermissionStatement];
      if (!allowed || actions.some((action) => !(allowed as readonly string[]).includes(action))) {
        context.addIssue({ code: "custom", message: `Unsupported permission: ${resource}` });
      }
      if (restrictedResources.has(resource) && actions.length > 0) {
        context.addIssue({
          code: "custom",
          message: `${resource} permissions are reserved for built-in roles`,
        });
      }
      if (resource === "team" && actions.length > 0) {
        context.addIssue({
          code: "custom",
          message: "Team administration is reserved for built-in roles",
        });
      }
    }
    if (value.ownership?.includes("transfer")) {
      context.addIssue({ code: "custom", message: "Ownership transfer cannot be delegated" });
    }
  });
const createRoleSchema = z.object({ permission: permissionSchema, role: roleNameSchema });
const updateRoleSchema = z.object({ permission: permissionSchema });

function asStatus(status: number) {
  return status as ContentfulStatusCode;
}

export function registerMerchantTeamRoutes(
  app: Hono<{ Variables: PlatformAppVariables }>,
  options: PlatformAppOptions,
  helpers: MerchantRouteHelpers,
) {
  const service = options.merchantTeamService;

  async function canManageOwner(input: { tenantId: string; userId: string }) {
    const result = await options.authorizeDashboardForTenant?.({
      permission: { ownership: ["transfer"] },
      tenantId: input.tenantId,
      userId: input.userId,
    });
    return result?.ok === true;
  }

  async function targetIsOwner(tenantId: string, memberId: string) {
    if (!service) return false;
    const result = await service.getOverview({ tenantId });
    return (
      result.ok &&
      result.team.members.some(
        (member) => member.id === memberId && member.role.split(",").includes("owner"),
      )
    );
  }

  app.get("/platform/merchant/team", async (context) => {
    if (!service) return context.json({ error: "team_service_unavailable" }, 503);
    const merchant = await helpers.getAuthorizedMerchantContext(context, { team: ["read"] });
    if (!merchant.ok) return merchant.response;
    const result = await service.getOverview({ tenantId: merchant.result.context.tenantId });
    if (!result.ok) return context.json(result, 404);
    const [canInvite, canManage, canManageRoles] = await Promise.all(
      (["invite", "manage", "roles"] as const).map(async (action) => {
        const authorization = await options.authorizeDashboardForTenant?.({
          permission: { team: [action] },
          tenantId: merchant.result.context.tenantId,
          userId: merchant.session.user.id,
        });
        return authorization?.ok === true;
      }),
    );
    return context.json({
      ...result,
      invitationAcceptBaseUrl: options.dashboardPublicBaseUrl ?? "http://app.lvh.me",
      invitationTenantId: merchant.result.context.tenantId,
      builtInRoles: Object.entries(builtInMerchantRolePermissions).map(([role, permission]) => ({
        permission,
        role,
      })),
      capabilities: {
        canInvite,
        canManage,
        canManageRoles,
        emailDeliveryAvailable: options.emailDeliveryConfigured === true,
      },
      currentUserId: merchant.session.user.id,
    });
  });

  app.post("/platform/merchant/team/invitations", async (context) => {
    if (!service) return context.json({ error: "team_service_unavailable" }, 503);
    const merchant = await helpers.getAuthorizedMerchantContext(context, { team: ["invite"] });
    if (!merchant.ok) return merchant.response;
    const parsed = inviteSchema.safeParse(await context.req.json().catch(() => null));
    if (!parsed.success)
      return context.json({ error: "invalid_invitation", issues: parsed.error.issues }, 400);
    if (
      parsed.data.role === "owner" &&
      !(await canManageOwner({
        tenantId: merchant.result.context.tenantId,
        userId: merchant.session.user.id,
      }))
    ) {
      return context.json({ error: "owner_role_forbidden" }, 403);
    }
    const result = await service.invite({
      actorUserId: merchant.session.user.id,
      headers: context.req.raw.headers,
      tenantId: merchant.result.context.tenantId,
      email: parsed.data.email,
      role: parsed.data.role,
      ...(parsed.data.resend === undefined ? {} : { resend: parsed.data.resend }),
    });
    return result.ok
      ? context.json(result)
      : context.json({ error: result.error }, asStatus(result.status));
  });

  app.post("/platform/merchant/team/invitations/:invitationId/cancel", async (context) => {
    if (!service) return context.json({ error: "team_service_unavailable" }, 503);
    const merchant = await helpers.getAuthorizedMerchantContext(context, { team: ["invite"] });
    if (!merchant.ok) return merchant.response;
    const result = await service.cancelInvitation({
      actorUserId: merchant.session.user.id,
      headers: context.req.raw.headers,
      invitationId: context.req.param("invitationId"),
      tenantId: merchant.result.context.tenantId,
    });
    return result.ok
      ? context.json(result)
      : context.json({ error: result.error }, asStatus(result.status));
  });

  app.patch("/platform/merchant/team/members/:memberId/role", async (context) => {
    if (!service) return context.json({ error: "team_service_unavailable" }, 503);
    const merchant = await helpers.getAuthorizedMerchantContext(context, { team: ["manage"] });
    if (!merchant.ok) return merchant.response;
    const parsed = memberRoleSchema.safeParse(await context.req.json().catch(() => null));
    if (!parsed.success) return context.json({ error: "invalid_role" }, 400);
    if (
      (parsed.data.role === "owner" ||
        (await targetIsOwner(merchant.result.context.tenantId, context.req.param("memberId")))) &&
      !(await canManageOwner({
        tenantId: merchant.result.context.tenantId,
        userId: merchant.session.user.id,
      }))
    ) {
      return context.json({ error: "owner_role_forbidden" }, 403);
    }
    const result = await service.updateMemberRole({
      actorUserId: merchant.session.user.id,
      headers: context.req.raw.headers,
      memberId: context.req.param("memberId"),
      role: parsed.data.role,
      tenantId: merchant.result.context.tenantId,
    });
    return result.ok
      ? context.json(result)
      : context.json({ error: result.error }, asStatus(result.status));
  });

  app.patch("/platform/merchant/team/members/:memberId/status", async (context) => {
    if (!service) return context.json({ error: "team_service_unavailable" }, 503);
    const merchant = await helpers.getAuthorizedMerchantContext(context, { team: ["manage"] });
    if (!merchant.ok) return merchant.response;
    const parsed = memberStatusSchema.safeParse(await context.req.json().catch(() => null));
    if (!parsed.success) return context.json({ error: "invalid_status" }, 400);
    if (
      (await targetIsOwner(merchant.result.context.tenantId, context.req.param("memberId"))) &&
      !(await canManageOwner({
        tenantId: merchant.result.context.tenantId,
        userId: merchant.session.user.id,
      }))
    ) {
      return context.json({ error: "owner_role_forbidden" }, 403);
    }
    const result = await service.setMemberStatus({
      actorUserId: merchant.session.user.id,
      memberId: context.req.param("memberId"),
      status: parsed.data.status,
      tenantId: merchant.result.context.tenantId,
    });
    return result.ok
      ? context.json(result)
      : context.json({ error: result.error }, asStatus(result.status));
  });

  app.delete("/platform/merchant/team/members/:memberId", async (context) => {
    if (!service) return context.json({ error: "team_service_unavailable" }, 503);
    const merchant = await helpers.getAuthorizedMerchantContext(context, { team: ["manage"] });
    if (!merchant.ok) return merchant.response;
    const memberId = context.req.param("memberId");
    if (
      (await targetIsOwner(merchant.result.context.tenantId, memberId)) &&
      !(await canManageOwner({
        tenantId: merchant.result.context.tenantId,
        userId: merchant.session.user.id,
      }))
    ) {
      return context.json({ error: "owner_role_forbidden" }, 403);
    }
    const result = await service.removeMember({
      actorUserId: merchant.session.user.id,
      headers: context.req.raw.headers,
      memberIdOrEmail: memberId,
      tenantId: merchant.result.context.tenantId,
    });
    return result.ok
      ? context.json(result)
      : context.json({ error: result.error }, asStatus(result.status));
  });

  app.post("/platform/merchant/team/roles", async (context) => {
    if (!service) return context.json({ error: "team_service_unavailable" }, 503);
    const merchant = await helpers.getAuthorizedMerchantContext(context, { team: ["roles"] });
    if (!merchant.ok) return merchant.response;
    const parsed = createRoleSchema.safeParse(await context.req.json().catch(() => null));
    if (!parsed.success)
      return context.json({ error: "invalid_role", issues: parsed.error.issues }, 400);
    if ((protectedMerchantRoleNames as readonly string[]).includes(parsed.data.role)) {
      return context.json({ error: "protected_role_name" }, 409);
    }
    const result = await service.createRole({
      actorUserId: merchant.session.user.id,
      headers: context.req.raw.headers,
      tenantId: merchant.result.context.tenantId,
      ...parsed.data,
      permission: normalizeMerchantRolePermissions(parsed.data.permission),
    });
    return result.ok
      ? context.json(result, 201)
      : context.json({ error: result.error }, asStatus(result.status));
  });

  app.patch("/platform/merchant/team/roles/:roleId", async (context) => {
    if (!service) return context.json({ error: "team_service_unavailable" }, 503);
    const merchant = await helpers.getAuthorizedMerchantContext(context, { team: ["roles"] });
    if (!merchant.ok) return merchant.response;
    const parsed = updateRoleSchema.safeParse(await context.req.json().catch(() => null));
    if (!parsed.success)
      return context.json({ error: "invalid_role", issues: parsed.error.issues }, 400);
    const result = await service.updateRole({
      actorUserId: merchant.session.user.id,
      headers: context.req.raw.headers,
      permission: normalizeMerchantRolePermissions(parsed.data.permission),
      roleId: context.req.param("roleId"),
      tenantId: merchant.result.context.tenantId,
    });
    return result.ok
      ? context.json(result)
      : context.json({ error: result.error }, asStatus(result.status));
  });

  app.delete("/platform/merchant/team/roles/:roleId", async (context) => {
    if (!service) return context.json({ error: "team_service_unavailable" }, 503);
    const merchant = await helpers.getAuthorizedMerchantContext(context, { team: ["roles"] });
    if (!merchant.ok) return merchant.response;
    const roleId = context.req.param("roleId");
    const result = await service.deleteRole({
      actorUserId: merchant.session.user.id,
      headers: context.req.raw.headers,
      roleId,
      tenantId: merchant.result.context.tenantId,
    });
    return result.ok
      ? context.json(result)
      : context.json({ error: result.error }, asStatus(result.status));
  });
}
