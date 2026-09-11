import { getAuthCookiePrefix } from "@ecs/config";
import type { createPlatformDb } from "@ecs/db";
import * as schema from "@ecs/db";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { organization } from "better-auth/plugins";
import { and, eq, ne } from "drizzle-orm";

import { merchantAccessControl, merchantRoles } from "../auth/merchant-permissions.js";
import type { NotificationProvider } from "../modules/notifications/providers/types.js";

type PlatformDb = ReturnType<typeof createPlatformDb>["db"];

export function requiresVerifiedEmailForInvitation(requireEmailVerification?: boolean) {
  return requireEmailVerification === true;
}

export function createPlatformAuth(options: {
  baseUrl?: string | undefined;
  cookieDomain?: string | undefined;
  /** Better Auth cookie prefix. Defaults to env / `ecs`. */
  cookiePrefix?: string | undefined;
  dashboardPublicBaseUrl?: string | undefined;
  db: PlatformDb;
  emailProvider?: NotificationProvider | undefined;
  requireEmailVerification?: boolean | undefined;
  secret: string;
  trustedOrigins?: string[] | undefined;
  useSecureCookies?: boolean | undefined;
}) {
  const emailProvider = options.emailProvider;
  const assertOrganizationKeepsOwner = async (input: {
    memberId: string;
    organizationId: string;
    currentRole: string;
    currentStatus?: string | undefined;
    nextRole?: string | undefined;
  }) => {
    const currentlyOwns = input.currentRole
      .split(",")
      .map((role) => role.trim())
      .includes("owner");
    const willOwn = input.nextRole
      ? input.nextRole
          .split(",")
          .map((role) => role.trim())
          .includes("owner")
      : false;
    if (!currentlyOwns || input.currentStatus === "suspended" || willOwn) return;

    const [anotherOwner] = await options.db
      .select({ id: schema.organizationMembers.id })
      .from(schema.organizationMembers)
      .where(
        and(
          eq(schema.organizationMembers.organizationId, input.organizationId),
          eq(schema.organizationMembers.role, "owner"),
          eq(schema.organizationMembers.status, "active"),
          ne(schema.organizationMembers.id, input.memberId),
        ),
      )
      .limit(1);

    if (!anotherOwner) {
      throw new APIError("BAD_REQUEST", {
        message: "Assign another active owner before changing or removing this owner.",
      });
    }
  };

  return betterAuth({
    advanced: getPlatformAuthCookieOptions(options),
    basePath: "/platform/auth",
    ...(options.baseUrl ? { baseURL: options.baseUrl } : {}),
    database: drizzleAdapter(options.db, {
      provider: "pg",
      schema: {
        ...schema,
        account: schema.accounts,
        invitation: schema.organizationInvitations,
        member: schema.organizationMembers,
        organization: schema.organizations,
        organizationRole: schema.organizationRoles,
        session: schema.sessions,
        user: schema.users,
        verification: schema.verifications,
      },
    }),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: options.requireEmailVerification ?? false,
    },
    ...(emailProvider
      ? {
          emailVerification: {
            autoSignInAfterVerification: false,
            sendOnSignIn: true,
            sendOnSignUp: true,
            sendVerificationEmail: async ({
              url,
              user,
            }: {
              url: string;
              user: { email: string };
            }) => {
              await emailProvider.send({
                body: `Verify your email address to finish creating your ECS account:\n\n${url}\n\nIf you did not create this account, you can ignore this email.`,
                channel: "email",
                eventType: "account.email_verification",
                recipient: user.email,
                subject: "Verify your ECS email address",
                tenantId: "platform",
              });
            },
          },
        }
      : {}),
    secret: options.secret,
    ...(options.trustedOrigins?.length ? { trustedOrigins: options.trustedOrigins } : {}),
    plugins: [
      organization({
        ac: merchantAccessControl,
        cancelPendingInvitationsOnReInvite: true,
        creatorRole: "owner",
        disableOrganizationDeletion: true,
        dynamicAccessControl: {
          enabled: true,
          maximumRolesPerOrganization: 20,
        },
        invitationExpiresIn: 60 * 60 * 24 * 7,
        // Keep invitation acceptance aligned with the account policy. Requiring a
        // verified address when verification delivery is disabled makes every
        // link-only invitation impossible to accept.
        requireEmailVerificationOnInvitation: requiresVerifiedEmailForInvitation(
          options.requireEmailVerification,
        ),
        roles: merchantRoles,
        organizationHooks: {
          beforeRemoveMember: async ({ member }) => {
            await assertOrganizationKeepsOwner({
              currentRole: member.role,
              currentStatus: member.status,
              memberId: member.id,
              organizationId: member.organizationId,
            });
          },
          beforeUpdateMemberRole: async ({ member, newRole }) => {
            await assertOrganizationKeepsOwner({
              currentRole: member.role,
              currentStatus: member.status,
              memberId: member.id,
              nextRole: Array.isArray(newRole) ? newRole.join(",") : newRole,
              organizationId: member.organizationId,
            });
          },
        },
        ...(emailProvider && options.dashboardPublicBaseUrl
          ? {
              sendInvitationEmail: async (data) => {
                const invitationUrl = new URL("/accept-invitation", options.dashboardPublicBaseUrl);
                invitationUrl.searchParams.set("invitationId", data.id);
                const [tenant] = await options.db
                  .select({ id: schema.tenants.id })
                  .from(schema.tenants)
                  .where(eq(schema.tenants.organizationId, data.organization.id))
                  .limit(1);
                if (tenant) invitationUrl.searchParams.set("tenantId", tenant.id);
                await emailProvider.send({
                  body: `${data.inviter.user.name} invited you to join ${data.organization.name} on ECS.\n\nAccept the invitation:\n${invitationUrl.toString()}\n\nThis invitation expires in 7 days. If you were not expecting it, you can ignore this email.`,
                  channel: "email",
                  eventType: "account.organization_invitation",
                  recipient: data.email,
                  subject: `Join ${data.organization.name} on ECS`,
                  tenantId: "platform",
                });
              },
            }
          : {}),
        schema: {
          invitation: { modelName: "organizationInvitations" },
          member: {
            additionalFields: {
              status: {
                defaultValue: "active",
                input: false,
                required: true,
                type: "string",
              },
            },
            modelName: "organizationMembers",
          },
          organization: { modelName: "organizations" },
          organizationRole: { modelName: "organizationRoles" },
        },
      }),
    ],
    user: {
      modelName: "users",
    },
    session: {
      // Merchant dashboard account actions (password/sessions) re-check current password
      // where needed; do not block on session "freshness" after a long browser session.
      freshAge: 0,
      modelName: "sessions",
    },
    account: {
      modelName: "accounts",
    },
    verification: {
      modelName: "verifications",
    },
  });
}

export function getPlatformAuthCookieOptions(options: {
  cookieDomain?: string | undefined;
  cookiePrefix?: string | undefined;
  useSecureCookies?: boolean | undefined;
}) {
  const cookiePrefix = options.cookiePrefix?.trim() || getAuthCookiePrefix();

  return {
    // Brand session cookies as ecs.* (or BETTER_AUTH_COOKIE_PREFIX) instead of better-auth.*.
    cookiePrefix,
    // Prefer real client IP when behind proxies / tunnels (session device list).
    ipAddress: {
      ipAddressHeaders: [
        "cf-connecting-ip",
        "true-client-ip",
        "x-real-ip",
        "x-forwarded-for",
        "x-client-ip",
      ],
    },
    defaultCookieAttributes: {
      sameSite: "lax" as const,
      path: "/",
      httpOnly: true,
    },
    ...(options.cookieDomain
      ? {
          crossSubDomainCookies: {
            domain: options.cookieDomain,
            enabled: true,
          },
        }
      : {}),
    trustedProxyHeaders: true,
    ...(options.useSecureCookies ? { useSecureCookies: true } : {}),
  };
}

export type PlatformAuth = ReturnType<typeof createPlatformAuth>;

export function parseTrustedOrigins(value: string | undefined) {
  return value
    ?.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}
