import { z } from "zod";

import { type PlatformRequestContext, platformFetch } from "./client";

const teamMemberSchema = z.object({
  createdAt: z.string(),
  email: z.string(),
  id: z.string(),
  image: z.string().nullable(),
  name: z.string(),
  role: z.string(),
  status: z.string(),
  userId: z.string(),
});
const teamInvitationSchema = z.object({
  createdAt: z.string(),
  email: z.string(),
  expiresAt: z.string(),
  id: z.string(),
  role: z.string(),
});
const teamRoleSchema = z.object({
  createdAt: z.string(),
  id: z.string(),
  permission: z.record(z.string(), z.array(z.string())),
  role: z.string(),
  updatedAt: z.string().nullable(),
});
const teamResponseSchema = z.object({
  builtInRoles: z.array(
    z.object({
      permission: z.record(z.string(), z.array(z.string())),
      role: z.string(),
    }),
  ),
  capabilities: z.object({
    canInvite: z.boolean(),
    canManage: z.boolean(),
    canManageRoles: z.boolean(),
    emailDeliveryAvailable: z.boolean(),
  }),
  currentUserId: z.string(),
  invitationAcceptBaseUrl: z.string().url(),
  invitationTenantId: z.string().min(1),
  ok: z.literal(true),
  team: z.object({
    invitations: z.array(teamInvitationSchema),
    members: z.array(teamMemberSchema),
    roles: z.array(teamRoleSchema),
  }),
});

export type MerchantTeam = z.infer<typeof teamResponseSchema>;
export type MerchantTeamResult =
  | { ok: true; value: MerchantTeam }
  | { ok: false; message: string; status: number };

export async function getMerchantTeam(
  options: PlatformRequestContext,
): Promise<MerchantTeamResult> {
  const response = await platformFetch("/platform/merchant/team", {
    ...options,
    method: "GET",
  });
  const data = await response.json().catch(() => undefined);
  if (!response.ok) {
    return {
      ok: false,
      message:
        data && typeof data === "object" && "error" in data && typeof data.error === "string"
          ? data.error
          : "team_request_failed",
      status: response.status,
    };
  }
  const parsed = teamResponseSchema.safeParse(data);
  return parsed.success
    ? { ok: true, value: parsed.data }
    : { ok: false, message: "invalid_team_response", status: 502 };
}

export async function mutateMerchantTeam(
  options: PlatformRequestContext & {
    body?: unknown;
    method: "DELETE" | "PATCH" | "POST";
    path: string;
  },
) {
  const { body, method, path, ...requestContext } = options;
  const response = await platformFetch(`/platform/merchant/team/${path}`, {
    ...requestContext,
    method,
    ...(body === undefined ? {} : { body: JSON.stringify(body), contentType: "json" as const }),
  });
  const data = await response.json().catch(() => undefined);
  if (!response.ok) {
    return {
      ok: false as const,
      message:
        data && typeof data === "object" && "error" in data && typeof data.error === "string"
          ? data.error
          : "team_update_failed",
      status: response.status,
    };
  }
  return { ok: true as const, data, status: response.status };
}
