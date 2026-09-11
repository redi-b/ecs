import {
  auditLogs,
  type createPlatformDb,
  organizationInvitations,
  organizationMembers,
  organizationRoles,
  tenants,
  users,
} from "@ecs/db";
import { and, asc, eq } from "drizzle-orm";

type PlatformDatabase = ReturnType<typeof createPlatformDb>["db"];

type TeamMutationResult =
  | { ok: true; data: unknown }
  | { ok: false; error: string; status: number };

function parsePermission(value: string): Record<string, string[]> {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed)
        .filter(([, actions]) => Array.isArray(actions))
        .map(([resource, actions]) => [
          resource,
          (actions as unknown[]).filter((action): action is string => typeof action === "string"),
        ]),
    );
  } catch {
    return {};
  }
}

async function readAuthResponse(response: Response): Promise<TeamMutationResult> {
  const data = await response.json().catch(() => undefined);
  if (response.ok) return { ok: true, data };

  const candidate = data as
    | { code?: unknown; message?: unknown; error?: { code?: unknown; message?: unknown } }
    | undefined;
  const error =
    (typeof candidate?.error?.code === "string" && candidate.error.code) ||
    (typeof candidate?.code === "string" && candidate.code) ||
    (typeof candidate?.error?.message === "string" && candidate.error.message) ||
    (typeof candidate?.message === "string" && candidate.message) ||
    "team_update_failed";
  return { ok: false, error, status: response.status };
}

export function createMerchantTeamService(input: {
  authHandler: (request: Request) => Promise<Response>;
  db: PlatformDatabase;
}) {
  async function getOrganizationId(tenantId: string) {
    const [tenant] = await input.db
      .select({ organizationId: tenants.organizationId })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);
    return tenant?.organizationId ?? null;
  }

  async function recordAudit(audit: {
    action: string;
    actorUserId: string;
    metadata?: Record<string, unknown>;
    targetId?: string;
    targetType: string;
    tenantId: string;
  }) {
    await input.db.insert(auditLogs).values({
      action: audit.action,
      actorUserId: audit.actorUserId,
      metadata: audit.metadata ?? {},
      targetId: audit.targetId,
      targetType: audit.targetType,
      tenantId: audit.tenantId,
    });
  }

  async function callOrganizationApi(args: {
    action: string;
    actorUserId: string;
    body: Record<string, unknown>;
    headers: Headers;
    path: string;
    targetId?: string;
    targetType: string;
    tenantId: string;
  }): Promise<TeamMutationResult> {
    const organizationId = await getOrganizationId(args.tenantId);
    if (!organizationId) return { ok: false, error: "organization_not_found", status: 404 };

    const headers = new Headers(args.headers);
    headers.set("content-type", "application/json");
    if (!headers.has("origin")) headers.set("origin", "http://api.lvh.me");
    const response = await input.authHandler(
      new Request(`http://api.lvh.me/platform/auth/organization/${args.path}`, {
        body: JSON.stringify({ ...args.body, organizationId }),
        headers,
        method: "POST",
      }),
    );
    const result = await readAuthResponse(response);
    if (result.ok) {
      await recordAudit({
        action: args.action,
        actorUserId: args.actorUserId,
        metadata: args.body,
        ...(args.targetId ? { targetId: args.targetId } : {}),
        targetType: args.targetType,
        tenantId: args.tenantId,
      });
    }
    return result;
  }

  return {
    async getOverview(args: { tenantId: string }) {
      const organizationId = await getOrganizationId(args.tenantId);
      if (!organizationId) return { ok: false as const, error: "organization_not_found" as const };

      const [members, invitations, roles] = await Promise.all([
        input.db
          .select({
            createdAt: organizationMembers.createdAt,
            email: users.email,
            id: organizationMembers.id,
            image: users.image,
            name: users.name,
            role: organizationMembers.role,
            status: organizationMembers.status,
            userId: organizationMembers.userId,
          })
          .from(organizationMembers)
          .innerJoin(users, eq(users.id, organizationMembers.userId))
          .where(eq(organizationMembers.organizationId, organizationId))
          .orderBy(asc(users.name)),
        input.db
          .select()
          .from(organizationInvitations)
          .where(
            and(
              eq(organizationInvitations.organizationId, organizationId),
              eq(organizationInvitations.status, "pending"),
            ),
          )
          .orderBy(asc(organizationInvitations.createdAt)),
        input.db
          .select()
          .from(organizationRoles)
          .where(eq(organizationRoles.organizationId, organizationId))
          .orderBy(asc(organizationRoles.role)),
      ]);

      return {
        ok: true as const,
        team: {
          invitations: invitations.map((invitation) => ({
            createdAt: invitation.createdAt.toISOString(),
            email: invitation.email,
            expiresAt: invitation.expiresAt.toISOString(),
            id: invitation.id,
            role: invitation.role ?? "staff",
          })),
          members: members.map((member) => ({
            ...member,
            createdAt: member.createdAt.toISOString(),
          })),
          roles: roles.map((role) => ({
            createdAt: role.createdAt.toISOString(),
            id: role.id,
            permission: parsePermission(role.permission),
            role: role.role,
            updatedAt: role.updatedAt?.toISOString() ?? null,
          })),
        },
      };
    },

    invite(args: {
      actorUserId: string;
      email: string;
      headers: Headers;
      resend?: boolean;
      role: string;
      tenantId: string;
    }) {
      return callOrganizationApi({
        action: args.resend ? "team.invitation_resent" : "team.invitation_created",
        actorUserId: args.actorUserId,
        body: { email: args.email, resend: args.resend ?? false, role: args.role },
        headers: args.headers,
        path: "invite-member",
        targetId: args.email,
        targetType: "organization_invitation",
        tenantId: args.tenantId,
      });
    },

    cancelInvitation(args: {
      actorUserId: string;
      headers: Headers;
      invitationId: string;
      tenantId: string;
    }) {
      return callOrganizationApi({
        action: "team.invitation_cancelled",
        actorUserId: args.actorUserId,
        body: { invitationId: args.invitationId },
        headers: args.headers,
        path: "cancel-invitation",
        targetId: args.invitationId,
        targetType: "organization_invitation",
        tenantId: args.tenantId,
      });
    },

    updateMemberRole(args: {
      actorUserId: string;
      headers: Headers;
      memberId: string;
      role: string;
      tenantId: string;
    }) {
      return callOrganizationApi({
        action: "team.member_role_updated",
        actorUserId: args.actorUserId,
        body: { memberId: args.memberId, role: args.role },
        headers: args.headers,
        path: "update-member-role",
        targetId: args.memberId,
        targetType: "organization_member",
        tenantId: args.tenantId,
      });
    },

    removeMember(args: {
      actorUserId: string;
      headers: Headers;
      memberIdOrEmail: string;
      tenantId: string;
    }) {
      return (async () => {
        const organizationId = await getOrganizationId(args.tenantId);
        if (!organizationId)
          return { ok: false as const, error: "organization_not_found", status: 404 };
        const [target] = await input.db
          .select({ userId: organizationMembers.userId })
          .from(organizationMembers)
          .where(
            and(
              eq(organizationMembers.id, args.memberIdOrEmail),
              eq(organizationMembers.organizationId, organizationId),
            ),
          )
          .limit(1);
        if (target?.userId === args.actorUserId) {
          return { ok: false as const, error: "cannot_remove_yourself", status: 409 };
        }
        return callOrganizationApi({
          action: "team.member_removed",
          actorUserId: args.actorUserId,
          body: { memberIdOrEmail: args.memberIdOrEmail },
          headers: args.headers,
          path: "remove-member",
          targetId: args.memberIdOrEmail,
          targetType: "organization_member",
          tenantId: args.tenantId,
        });
      })();
    },

    async setMemberStatus(args: {
      actorUserId: string;
      memberId: string;
      status: "active" | "suspended";
      tenantId: string;
    }): Promise<TeamMutationResult> {
      const organizationId = await getOrganizationId(args.tenantId);
      if (!organizationId) return { ok: false, error: "organization_not_found", status: 404 };
      const [target] = await input.db
        .select({ userId: organizationMembers.userId })
        .from(organizationMembers)
        .where(
          and(
            eq(organizationMembers.id, args.memberId),
            eq(organizationMembers.organizationId, organizationId),
          ),
        )
        .limit(1);
      if (!target) return { ok: false, error: "member_not_found", status: 404 };
      if (args.actorUserId === target.userId && args.status === "suspended") {
        return { ok: false, error: "cannot_suspend_yourself", status: 409 };
      }
      try {
        const [updated] = await input.db.transaction(async (transaction) => {
          const rows = await transaction
            .update(organizationMembers)
            .set({ status: args.status })
            .where(
              and(
                eq(organizationMembers.id, args.memberId),
                eq(organizationMembers.organizationId, organizationId),
              ),
            )
            .returning({ id: organizationMembers.id });
          if (!rows[0]) return rows;
          await transaction.insert(auditLogs).values({
            action: args.status === "active" ? "team.member_reactivated" : "team.member_suspended",
            actorUserId: args.actorUserId,
            metadata: { status: args.status },
            targetId: args.memberId,
            targetType: "organization_member",
            tenantId: args.tenantId,
          });
          return rows;
        });
        return updated
          ? { ok: true, data: { id: updated.id, status: args.status } }
          : { ok: false, error: "member_not_found", status: 404 };
      } catch (error) {
        return {
          ok: false,
          error:
            error instanceof Error && error.message.includes("active owner")
              ? "active_owner_required"
              : "member_status_update_failed",
          status: 409,
        };
      }
    },

    createRole(args: {
      actorUserId: string;
      headers: Headers;
      permission: Record<string, string[]>;
      role: string;
      tenantId: string;
    }) {
      return callOrganizationApi({
        action: "team.role_created",
        actorUserId: args.actorUserId,
        body: { permission: args.permission, role: args.role },
        headers: args.headers,
        path: "create-role",
        targetId: args.role,
        targetType: "organization_role",
        tenantId: args.tenantId,
      });
    },

    updateRole(args: {
      actorUserId: string;
      headers: Headers;
      permission: Record<string, string[]>;
      roleId: string;
      tenantId: string;
    }) {
      return callOrganizationApi({
        action: "team.role_updated",
        actorUserId: args.actorUserId,
        body: { data: { permission: args.permission }, roleId: args.roleId },
        headers: args.headers,
        path: "update-role",
        targetId: args.roleId,
        targetType: "organization_role",
        tenantId: args.tenantId,
      });
    },

    deleteRole(args: { actorUserId: string; headers: Headers; roleId: string; tenantId: string }) {
      return callOrganizationApi({
        action: "team.role_deleted",
        actorUserId: args.actorUserId,
        body: { roleId: args.roleId },
        headers: args.headers,
        path: "delete-role",
        targetId: args.roleId,
        targetType: "organization_role",
        tenantId: args.tenantId,
      });
    },
  };
}
