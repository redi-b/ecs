import { z } from "zod";

/** Accept familiar Ethiopian notation; store one international representation. */
export function normalizeEthiopianPhone(value: string): string {
  const compact = value.trim().replace(/[\s().-]/g, "");
  const national = compact.startsWith("+251")
    ? compact.slice(4)
    : compact.startsWith("00251")
      ? compact.slice(5)
      : compact.startsWith("251") && compact.length === 12
        ? compact.slice(3)
        : compact;
  const digits = national.startsWith("0") ? national.slice(1) : national;
  return /^[1-9]\d{8}$/.test(digits) ? `+251${digits}` : compact;
}

export const userCalendarPreferenceSchema = z.enum(["follow-language", "ethiopian", "gregorian"]);
export type UserCalendarPreference = z.infer<typeof userCalendarPreferenceSchema>;

export const ethiopianPhoneSchema = z
  .string()
  .transform(normalizeEthiopianPhone)
  .pipe(z.string().regex(/^\+251[1-9]\d{8}$/, "Enter a valid Ethiopian phone number."));

export const shopSocialPlatforms = [
  "facebook",
  "instagram",
  "tiktok",
  "telegram",
  "whatsapp",
  "youtube",
  "linkedin",
  "x",
] as const;
const shopSocialHosts: Record<(typeof shopSocialPlatforms)[number], readonly string[]> = {
  facebook: ["facebook.com", "fb.com"],
  instagram: ["instagram.com"],
  tiktok: ["tiktok.com"],
  telegram: ["t.me", "telegram.me"],
  whatsapp: ["wa.me", "api.whatsapp.com", "whatsapp.com"],
  youtube: ["youtube.com", "youtu.be"],
  linkedin: ["linkedin.com"],
  x: ["x.com", "twitter.com"],
};

const shopSocialBaseUrls: Record<(typeof shopSocialPlatforms)[number], string> = {
  facebook: "https://facebook.com/",
  instagram: "https://instagram.com/",
  tiktok: "https://tiktok.com/@",
  telegram: "https://t.me/",
  whatsapp: "https://wa.me/",
  youtube: "https://youtube.com/@",
  linkedin: "https://linkedin.com/company/",
  x: "https://x.com/",
};

/** Turn a pasted profile URL, @handle, username, or WhatsApp number into a canonical link. */
export function normalizeShopSocialProfileUrl(
  platform: (typeof shopSocialPlatforms)[number],
  value: string,
): string {
  const trimmed = value.trim();
  if (!trimmed) return "";

  const possibleUrl = /^(?:https?:\/\/|www\.)/i.test(trimmed)
    ? trimmed.replace(/^http:\/\//i, "https://").replace(/^www\./i, "https://www.")
    : null;
  if (possibleUrl) return possibleUrl;

  let handle = trimmed.replace(/^@/, "").replace(/^\/+|\/+$/g, "");
  if (platform === "whatsapp") {
    handle = normalizeEthiopianPhone(handle).replace(/^\+/, "");
    if (!/^251[1-9]\d{8}$/.test(handle)) return trimmed;
  } else if (!/^[a-zA-Z0-9._-]+$/.test(handle)) {
    return trimmed;
  }
  return `${shopSocialBaseUrls[platform]}${handle}`;
}

export const shopSocialProfileSchema = z
  .object({
    platform: z.enum(shopSocialPlatforms),
    url: z.string().trim().max(500),
  })
  .strict()
  .transform((profile) => ({
    ...profile,
    url: normalizeShopSocialProfileUrl(profile.platform, profile.url),
  }))
  .superRefine(({ platform, url }, context) => {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      context.addIssue({ code: "custom", path: ["url"], message: "Enter a valid profile link." });
      return;
    }
    const host = parsed.hostname.toLowerCase();
    if (
      parsed.protocol !== "https:" ||
      parsed.username ||
      parsed.password ||
      !shopSocialHosts[platform].some((allowed) => host === allowed || host.endsWith(`.${allowed}`))
    ) {
      context.addIssue({
        code: "custom",
        path: ["url"],
        message: "Use a secure link to the selected platform.",
      });
    }
  });

/** Public business information, distinct from the owner's private account. */
export const shopDetailsSchema = z
  .object({
    version: z.literal(1),
    categories: z.array(z.string().trim().min(1).max(80)).min(1).max(5),
    description: z.string().trim().max(300).default(""),
    primaryPhone: ethiopianPhoneSchema,
    additionalPhones: z.array(ethiopianPhoneSchema).max(3).default([]),
    publicEmail: z.union([z.literal(""), z.string().trim().email().max(254)]).default(""),
    address: z
      .object({
        city: z.string().trim().max(100).default(""),
        streetAddress: z.string().trim().max(500).default(""),
        directions: z.string().trim().max(300).default(""),
      })
      .strict()
      .optional(),
    socialProfiles: z.array(shopSocialProfileSchema).max(8).default([]),
    brand: z
      .object({
        presetId: z
          .enum(["original", "blue", "rose", "amber", "violet", "teal"])
          .default("original"),
        customPrimary: z
          .string()
          .regex(/^#[0-9a-f]{6}$/i)
          .optional(),
      })
      .strict()
      .optional(),
  })
  .strict()
  .superRefine((details, context) => {
    const phones = [details.primaryPhone, ...details.additionalPhones];
    if (new Set(phones).size !== phones.length) {
      context.addIssue({
        code: "custom",
        path: ["additionalPhones"],
        message: "Each phone number should be different.",
      });
    }
    const platforms = details.socialProfiles.map((profile) => profile.platform);
    if (new Set(platforms).size !== platforms.length) {
      context.addIssue({
        code: "custom",
        path: ["socialProfiles"],
        message: "Add each social platform only once.",
      });
    }
  });

export type ShopDetails = z.infer<typeof shopDetailsSchema>;

export const launchReadinessSchema = z.object({
  tenantId: z.string(),
  isPublished: z.boolean(),
  draftFingerprint: z.string(),
  checks: z.array(
    z.object({
      id: z.enum(["profile", "catalog", "fulfillment", "payments", "review"]),
      status: z.enum(["ready", "action_required", "unavailable"]),
    }),
  ),
  canPublish: z.boolean(),
});
export type LaunchReadiness = z.infer<typeof launchReadinessSchema>;

/** Store preferences, never SVG or a third-party image URL. */
export const profileAvatarSchema = z
  .object({
    version: z.literal(1),
    color: z.enum(["blue", "sky", "mint", "lavender", "sand", "coral", "rose"]),
    variation: z.number().int().min(0).max(999999),
    eyes: z
      .enum([
        "auto",
        "variant01",
        "variant02",
        "variant03",
        "variant04",
        "variant05",
        "variant06",
        "variant07",
        "variant08",
      ])
      .default("auto"),
    angle: z.enum(["left", "straight", "right"]).default("straight"),
  })
  .strict();

export type ProfileAvatarPreferences = z.infer<typeof profileAvatarSchema>;

export const defaultProfileAvatar: ProfileAvatarPreferences = {
  version: 1,
  color: "blue",
  variation: 0,
  eyes: "auto",
  angle: "straight",
};

export function parseProfileAvatar(value: unknown): ProfileAvatarPreferences | null {
  try {
    const parsed = profileAvatarSchema.safeParse(
      typeof value === "string" ? JSON.parse(value) : value,
    );
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** Also validates direct Better Auth requests, not only the dashboard proxy. */
export const serializedProfileAvatarSchema = z
  .string()
  .max(150)
  .refine((value) => parseProfileAvatar(value) !== null, "Invalid avatar preferences");
