import { getAuthCookiePrefix } from "@ecs/config";
import { serializedProfileAvatarSchema } from "@ecs/contracts";
import type { createPlatformDb } from "@ecs/db";
import * as schema from "@ecs/db";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { organization } from "better-auth/plugins";
import { and, eq, ne } from "drizzle-orm";
import { getEmailTemplateDefinition } from "../modules/email/template-catalog.js";
import { renderEmailTemplate } from "../modules/email/template-renderer.js";
import type { NotificationProvider } from "../modules/notifications/providers/types.js";
import { merchantAccessControl, merchantRoles } from "./merchant-permissions.js";

type PlatformDb = ReturnType<typeof createPlatformDb>["db"];

export function requiresVerifiedEmailForInvitation(requireEmailVerification?: boolean) {
  return requireEmailVerification === true;
}

export function getPasswordResetActionUrl(input: {
  dashboardPublicBaseUrl?: string | undefined;
  generatedUrl: string;
  token: string;
}) {
  const generatedUrl = new URL(input.generatedUrl);
  const callbackUrl = generatedUrl.searchParams.get("callbackURL");
  const dashboardUrl = new URL(callbackUrl || input.dashboardPublicBaseUrl || generatedUrl.origin);
  const actionUrl = new URL("/reset-password/verify", dashboardUrl.origin);
  actionUrl.searchParams.set("token", input.token);
  return actionUrl.toString();
}

export function getEmailVerificationActionUrl(input: {
  dashboardPublicBaseUrl?: string | undefined;
  generatedUrl: string;
  intent: "approve-email-change" | "verify-email";
  token: string;
}) {
  const generatedUrl = new URL(input.generatedUrl);
  const callbackUrl = new URL(
    generatedUrl.searchParams.get("callbackURL") || "/",
    input.dashboardPublicBaseUrl || generatedUrl.origin,
  );
  const returnTo = `${callbackUrl.pathname}${callbackUrl.search}`;
  const actionUrl = new URL("/verify-email", callbackUrl.origin);
  actionUrl.searchParams.set("token", input.token);
  actionUrl.searchParams.set("intent", input.intent);
  actionUrl.searchParams.set("returnTo", returnTo);
  return actionUrl.toString();
}

export function renderAccountVerificationEmail(input: {
  actionUrl: string;
  recipientName: string;
}) {
  const template = getEmailTemplateDefinition("account.email_verification");
  if (!template) throw new Error("account_email_verification_template_missing");
  const source = template.locales.en;
  return renderEmailTemplate({
    content: source.content,
    locale: "en",
    preheader: source.preheader,
    subject: source.subject,
    variables: {
      action_url: input.actionUrl,
      recipient_name: input.recipientName,
    },
  });
}

export async function deliverAccountVerificationEmail(input: {
  actionUrl: string;
  emailProvider?: NotificationProvider | undefined;
  enqueueAccountEmail?:
    | ((input: {
        idempotencySource: string;
        recipient: string;
        templateKey: string;
        tenantId?: string | null | undefined;
        variables: Record<string, string>;
      }) => Promise<unknown>)
    | undefined;
  generatedUrl: string;
  recipient: string;
  recipientName: string;
}) {
  if (input.enqueueAccountEmail) {
    await input.enqueueAccountEmail({
      idempotencySource: input.generatedUrl,
      recipient: input.recipient,
      templateKey: "account.email_verification",
      variables: { action_url: input.actionUrl, recipient_name: input.recipientName },
    });
    return "queued" as const;
  }
  if (!input.emailProvider) throw new Error("email_delivery_unavailable");
  const rendered = renderAccountVerificationEmail({
    actionUrl: input.actionUrl,
    recipientName: input.recipientName,
  });
  await input.emailProvider.send({
    body: rendered.text,
    channel: "email",
    eventType: "account.email_verification",
    html: rendered.html,
    recipient: input.recipient,
    senderProfile: "accounts",
    subject: rendered.subject,
    tenantId: "platform",
  });
  return "sent" as const;
}

export function createPlatformAuth(options: {
  baseUrl?: string | undefined;
  cookieDomain?: string | undefined;
  /** Better Auth cookie prefix. Defaults to env / `ecs`. */
  cookiePrefix?: string | undefined;
  dashboardPublicBaseUrl?: string | undefined;
  db: PlatformDb;
  emailProvider?: NotificationProvider | undefined;
  enqueueAccountEmail?:
    | ((input: {
        idempotencySource: string;
        recipient: string;
        templateKey: string;
        tenantId?: string | null | undefined;
        variables: Record<string, string>;
      }) => Promise<unknown>)
    | undefined;
  requireEmailVerification?: boolean | undefined;
  secret: string;
  trustedOrigins?: string[] | undefined;
  useSecureCookies?: boolean | undefined;
}) {
  const emailProvider = options.emailProvider;
  const enqueueAccountEmail = options.enqueueAccountEmail;
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
        rateLimit: schema.authRateLimits,
        user: schema.users,
        verification: schema.verifications,
      },
    }),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: options.requireEmailVerification ?? false,
      revokeSessionsOnPasswordReset: true,
      ...(enqueueAccountEmail
        ? {
            sendResetPassword: async ({ token, url, user }) => {
              const actionUrl = getPasswordResetActionUrl({
                dashboardPublicBaseUrl: options.dashboardPublicBaseUrl,
                generatedUrl: url,
                token,
              });
              await enqueueAccountEmail({
                idempotencySource: url,
                recipient: user.email,
                templateKey: "account.password_reset",
                variables: { action_url: actionUrl, recipient_name: user.name || "there" },
              });
            },
          }
        : {}),
    },
    ...(enqueueAccountEmail || emailProvider
      ? {
          emailVerification: {
            autoSignInAfterVerification: false,
            // Signup and explicit resend own delivery. Silently sending another
            // token on every rejected sign-in creates confusing duplicate mail.
            sendOnSignIn: false,
            // Signup explicitly requests delivery after the account exists so
            // the dashboard can show a truthful sent/retry state.
            sendOnSignUp: false,
            sendVerificationEmail: async ({ token, url, user }) => {
              const actionUrl = getEmailVerificationActionUrl({
                dashboardPublicBaseUrl: options.dashboardPublicBaseUrl,
                generatedUrl: url,
                intent: "verify-email",
                token,
              });
              // Account verification is time-sensitive. Send it inline when a
              // provider is available so signup doesn't claim an email was sent
              // while it is still waiting behind the general delivery queue.
              await deliverAccountVerificationEmail({
                actionUrl,
                emailProvider,
                enqueueAccountEmail,
                generatedUrl: url,
                recipient: user.email,
                recipientName: user.name || "there",
              });
            },
          },
        }
      : {}),
    secret: options.secret,
    ...(options.trustedOrigins?.length ? { trustedOrigins: options.trustedOrigins } : {}),
    rateLimit: {
      customRules: {
        "/change-email": { max: 3, window: 60 },
        "/organization/invite-member": { max: 10, window: 60 },
        "/request-password-reset": { max: 3, window: 60 },
        "/send-verification-email": { max: 3, window: 60 },
      },
      enabled: true,
      max: 100,
      modelName: "authRateLimits",
      storage: "database",
      window: 60,
    },
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
        ...((enqueueAccountEmail || emailProvider) && options.dashboardPublicBaseUrl
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
                if (enqueueAccountEmail) {
                  await enqueueAccountEmail({
                    idempotencySource: data.id,
                    recipient: data.email,
                    templateKey: "account.organization_invitation",
                    tenantId: tenant?.id ?? null,
                    variables: {
                      action_url: invitationUrl.toString(),
                      inviter_name: data.inviter.user.name || "A shop owner",
                      recipient_name: data.email.split("@")[0] || "there",
                      shop_name: data.organization.name,
                    },
                  });
                } else if (emailProvider) {
                  await emailProvider.send({
                    body: `${data.inviter.user.name} invited you to join ${data.organization.name} on ECS.\n\n${invitationUrl.toString()}`,
                    channel: "email",
                    eventType: "account.organization_invitation",
                    recipient: data.email,
                    senderProfile: "accounts",
                    subject: `Join ${data.organization.name} on ECS`,
                    tenantId: tenant?.id ?? "platform",
                  });
                }
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
      additionalFields: {
        avatarPreferences: {
          type: "string",
          required: false,
          input: true,
          validator: { input: serializedProfileAvatarSchema },
        },
      },
      ...(enqueueAccountEmail
        ? {
            changeEmail: {
              enabled: true,
              sendChangeEmailConfirmation: async ({ newEmail, token, url, user }) => {
                const actionUrl = getEmailVerificationActionUrl({
                  dashboardPublicBaseUrl: options.dashboardPublicBaseUrl,
                  generatedUrl: url,
                  intent: "approve-email-change",
                  token,
                });
                await enqueueAccountEmail({
                  idempotencySource: url,
                  recipient: user.email,
                  templateKey: "account.email_change_current",
                  variables: {
                    action_url: actionUrl,
                    new_email: newEmail,
                    recipient_name: user.name || "there",
                  },
                });
              },
            },
          }
        : {}),
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
