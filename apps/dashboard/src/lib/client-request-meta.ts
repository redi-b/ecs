/** Client identity headers for auth session capture (IP / UA). */

export function getClientIp(headers: Headers): string | null {
  const candidates = [
    headers.get("cf-connecting-ip"),
    headers.get("true-client-ip"),
    headers.get("x-real-ip"),
    headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
    headers.get("x-client-ip"),
  ];
  for (const value of candidates) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return null;
}

export function getClientUserAgent(headers: Headers): string | null {
  const ua = headers.get("user-agent")?.trim();
  return ua || null;
}
