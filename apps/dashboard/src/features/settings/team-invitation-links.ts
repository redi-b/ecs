export function invitationUrl(origin: string, invitationId: string, tenantId?: string) {
  const url = new URL("/accept-invitation", origin);
  url.searchParams.set("invitationId", invitationId);
  if (tenantId) url.searchParams.set("tenantId", tenantId);
  return url.toString();
}

export function telegramInvitationShareUrl(inviteUrl: string, message: string) {
  const url = new URL("https://t.me/share/url");
  url.searchParams.set("url", inviteUrl);
  url.searchParams.set("text", message);
  return url.toString();
}
