export const VERIFICATION_EMAIL_COOKIE = "ecs.verification_email";

export function getVerificationEmailCookie(email: string) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${VERIFICATION_EMAIL_COOKIE}=${encodeURIComponent(email.trim().toLowerCase())}; Max-Age=3600; HttpOnly; SameSite=Strict; Path=/${secure}`;
}

export function readVerificationEmailCookie(value: string | undefined) {
  if (!value) return null;
  try {
    const email = decodeURIComponent(value).trim().toLowerCase();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 320 ? email : null;
  } catch {
    return null;
  }
}
