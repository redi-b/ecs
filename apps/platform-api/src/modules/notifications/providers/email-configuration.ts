export const EMAIL_SENDER_PROFILES = ["accounts", "notifications", "billing", "orders"] as const;

export type EmailSenderProfile = (typeof EMAIL_SENDER_PROFILES)[number];

export type EmailSenderConfiguration = {
  fallback: string | null;
  profiles: Record<EmailSenderProfile, string | null>;
  supportReplyTo: string | null;
};

const mailboxPattern = /^(?:[^<>\r\n]+\s*)?<[^<>\s@]+@[^<>\s@]+>|^[^\s<>@]+@[^\s<>@]+$/;

export function resolveEmailSenderConfiguration(env: NodeJS.ProcessEnv): EmailSenderConfiguration {
  const fallback = normalizeMailbox(env.EMAIL_FROM);
  return {
    fallback,
    profiles: {
      accounts: normalizeMailbox(env.EMAIL_FROM_ACCOUNTS) ?? fallback,
      billing: normalizeMailbox(env.EMAIL_FROM_BILLING) ?? fallback,
      notifications: normalizeMailbox(env.EMAIL_FROM_NOTIFICATIONS) ?? fallback,
      orders: normalizeMailbox(env.EMAIL_FROM_ORDERS) ?? fallback,
    },
    supportReplyTo: normalizeMailbox(env.EMAIL_REPLY_TO_SUPPORT),
  };
}

export function validateEmailSenderConfiguration(input: {
  env: NodeJS.ProcessEnv;
  production?: boolean;
}) {
  const configured = resolveEmailSenderConfiguration(input.env);
  const rawValues = [
    input.env.EMAIL_FROM,
    input.env.EMAIL_FROM_ACCOUNTS,
    input.env.EMAIL_FROM_NOTIFICATIONS,
    input.env.EMAIL_FROM_BILLING,
    input.env.EMAIL_FROM_ORDERS,
    input.env.EMAIL_REPLY_TO_SUPPORT,
  ].filter((value): value is string => Boolean(value?.trim()));
  if (rawValues.some((value) => !normalizeMailbox(value))) {
    return "Email sender and reply addresses must be valid mailboxes";
  }
  if (input.production) {
    const missing = EMAIL_SENDER_PROFILES.filter((profile) => !configured.profiles[profile]);
    if (missing.length) return `Missing production email sender profiles: ${missing.join(", ")}`;
  }
  return null;
}

export function normalizeMailbox(value: string | undefined) {
  const normalized = value?.trim() ?? "";
  return normalized && normalized.length <= 320 && mailboxPattern.test(normalized)
    ? normalized
    : null;
}
