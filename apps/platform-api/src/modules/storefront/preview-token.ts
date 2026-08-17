import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

export type StorefrontPreviewTokenPayload = {
  expiresAt: number;
  nonce: string;
  tenantId: string;
  userId: string;
};

export function createStorefrontPreviewToken(input: {
  now?: number;
  secret: string;
  tenantId: string;
  ttlSeconds?: number;
  userId: string;
}) {
  const now = input.now ?? Date.now();
  const payload: StorefrontPreviewTokenPayload = {
    expiresAt: now + (input.ttlSeconds ?? 15 * 60) * 1000,
    nonce: randomUUID(),
    tenantId: input.tenantId,
    userId: input.userId,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return {
    expiresAt: new Date(payload.expiresAt).toISOString(),
    token: `${encoded}.${sign(encoded, input.secret)}`,
  };
}

export function verifyStorefrontPreviewToken(input: {
  now?: number;
  secret: string;
  token: string;
}): StorefrontPreviewTokenPayload | null {
  const [encoded, signature, ...rest] = input.token.split(".");
  if (!encoded || !signature || rest.length > 0) return null;

  const expected = sign(encoded, input.secret);
  const actualBytes = Buffer.from(signature);
  const expectedBytes = Buffer.from(expected);
  if (actualBytes.length !== expectedBytes.length || !timingSafeEqual(actualBytes, expectedBytes)) {
    return null;
  }

  try {
    const value: unknown = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    if (!isPayload(value) || value.expiresAt <= (input.now ?? Date.now())) return null;
    return value;
  } catch {
    return null;
  }
}

function sign(value: string, secret: string) {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

function isPayload(value: unknown): value is StorefrontPreviewTokenPayload {
  if (!value || typeof value !== "object") return false;
  const payload = value as Record<string, unknown>;
  return (
    typeof payload.expiresAt === "number" &&
    Number.isFinite(payload.expiresAt) &&
    typeof payload.nonce === "string" &&
    payload.nonce.length > 0 &&
    typeof payload.tenantId === "string" &&
    payload.tenantId.length > 0 &&
    typeof payload.userId === "string" &&
    payload.userId.length > 0
  );
}
