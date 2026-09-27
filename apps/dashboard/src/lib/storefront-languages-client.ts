import type { StorefrontLanguageSettings } from "@ecs/contracts";
import { dashboardRoutes } from "@/lib/routes";

export type SaveStorefrontLanguageSettingsResult =
  | { ok: true; languageSettings: StorefrontLanguageSettings }
  | { ok: false; message: string | null };

export async function saveStorefrontLanguageSettings({
  languageSettings,
  tenantId,
}: {
  languageSettings: StorefrontLanguageSettings;
  tenantId: string;
}): Promise<SaveStorefrontLanguageSettingsResult> {
  const response = await fetch(dashboardRoutes.storefrontLanguagesAction, {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/json" },
    body: JSON.stringify({ tenantId, languageSettings }),
  }).catch(() => null);

  if (!response) return { ok: false, message: null };
  const result = (await response.json().catch(() => null)) as {
    languageSettings?: StorefrontLanguageSettings;
    message?: string;
  } | null;
  if (!response.ok || !result?.languageSettings) {
    return { ok: false, message: result?.message ?? null };
  }
  return { ok: true, languageSettings: result.languageSettings };
}
