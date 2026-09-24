import { storefrontLocaleSchema } from "@ecs/contracts";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  getStorefrontTranslationFields,
  hashStorefrontSource,
} from "@/lib/storefront-localization-fields";
import { getStorefrontDraft, updateStorefrontDraft } from "@/lib/storefront-templates";

const bodySchema = z.object({
  locale: storefrontLocaleSchema.exclude(["en"]),
  tenantId: z.string().min(1),
  translations: z.record(z.string().min(1).max(240), z.string().max(20_000)),
});

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ message: "invalid_translation" }, { status: 400 });

  const requestHeaders = await headers();
  const platformApiBaseUrl = process.env.PLATFORM_API_BASE_URL ?? "http://localhost:3000";
  const draftResult = await getStorefrontDraft({
    cookieHeader: requestHeaders.get("cookie"),
    platformApiBaseUrl,
    tenantId: parsed.data.tenantId,
  });
  if (!draftResult.ok) {
    return NextResponse.json({ message: draftResult.message }, { status: draftResult.status });
  }

  const draft = draftResult.draft;
  const fields = getStorefrontTranslationFields({
    data: draft.data,
    seo: draft.seo,
    templateKey: draft.templateKey,
  });
  const allowed = new Map(fields.map((field) => [field.path, field]));
  const locale = parsed.data.locale;
  const localizedFields = { ...(draft.localizedContent.locales[locale] ?? {}) };
  for (const [path, rawValue] of Object.entries(parsed.data.translations)) {
    const field = allowed.get(path);
    if (!field) return NextResponse.json({ message: "invalid_translation_field" }, { status: 400 });
    const value = rawValue.trim();
    if (!value) delete localizedFields[path];
    else localizedFields[path] = { value, sourceHash: hashStorefrontSource(field.source) };
  }

  const localizedContent = {
    ...draft.localizedContent,
    locales: { ...draft.localizedContent.locales, [locale]: localizedFields },
  };
  const updated = await updateStorefrontDraft({
    cookieHeader: requestHeaders.get("cookie"),
    data: draft.data,
    languageSettings: draft.languageSettings,
    localizedContent,
    platformApiBaseUrl,
    tenantId: draft.tenantId,
    themeTokens: draft.themeTokens,
  });
  if (!updated.ok)
    return NextResponse.json({ message: updated.message }, { status: updated.status });
  return NextResponse.json({ localizedContent: updated.draft.localizedContent });
}
