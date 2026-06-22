import { createHmac, timingSafeEqual } from "node:crypto";

export const dashboardSessionCookieName = "ecs_dashboard_session";
export const dashboardSessionMaxAgeSeconds = 60 * 60 * 24 * 7;

export type DashboardSession = {
  email: string;
  issuedAt: string;
};

export function createDashboardSession(options: { email: string; now?: Date; secret: string }) {
  const session: DashboardSession = {
    email: options.email.trim().toLowerCase(),
    issuedAt: (options.now ?? new Date()).toISOString(),
  };
  const payload = encode(JSON.stringify(session));
  const signature = sign(payload, options.secret);

  return `${payload}.${signature}`;
}

export function verifyDashboardSession(options: {
  cookieValue?: string | null;
  maxAgeSeconds?: number;
  now?: Date;
  secret: string;
}): DashboardSession | null {
  if (!options.cookieValue) {
    return null;
  }

  const [payload, signature] = options.cookieValue.split(".");

  if (!payload || !signature || !isValidSignature(payload, signature, options.secret)) {
    return null;
  }

  const parsed = parseSession(payload);

  if (!parsed) {
    return null;
  }

  const maxAgeSeconds = options.maxAgeSeconds ?? dashboardSessionMaxAgeSeconds;
  const now = options.now ?? new Date();
  const issuedAt = new Date(parsed.issuedAt);

  if (Number.isNaN(issuedAt.getTime())) {
    return null;
  }

  if (now.getTime() - issuedAt.getTime() > maxAgeSeconds * 1000) {
    return null;
  }

  return parsed;
}

export function getDashboardSessionSecret() {
  return (
    process.env.DASHBOARD_SESSION_SECRET?.trim() ||
    process.env.BETTER_AUTH_SECRET?.trim() ||
    "development-dashboard-session-secret"
  );
}

function parseSession(payload: string): DashboardSession | null {
  try {
    const value = JSON.parse(decode(payload));

    if (!isRecord(value) || typeof value.email !== "string" || typeof value.issuedAt !== "string") {
      return null;
    }

    if (!value.email.trim()) {
      return null;
    }

    return {
      email: value.email.trim().toLowerCase(),
      issuedAt: value.issuedAt,
    };
  } catch {
    return null;
  }
}

function sign(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function isValidSignature(payload: string, signature: string, secret: string) {
  const expected = sign(payload, secret);
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(signature);

  if (expectedBuffer.length !== actualBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, actualBuffer);
}

function encode(value: string) {
  return Buffer.from(value).toString("base64url");
}

function decode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
