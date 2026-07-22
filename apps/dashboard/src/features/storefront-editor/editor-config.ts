import { createUsePuck } from "@puckeditor/core";

import type { StorefrontDraft } from "@/features/storefront-editor/editor-state";

export type { PublicationStatus, StorefrontDraft } from "@/features/storefront-editor/editor-state";

export type StorefrontVisualEditorProps = {
  draft: StorefrontDraft;
  editorMeta: {
    initiallyPublished: boolean;
    liveStorefrontUrl: string;
    settingsUrl: string;
    storefrontName: string;
    templateKey: string;
    templateName: string;
  };
  onPublish: (tenantId: string) => Promise<ActionResult>;
  onUnpublish?: (tenantId: string) => Promise<ActionResult>;
  onSave: (payload: {
    data: unknown;
    tenantId: string;
    themeTokens: unknown;
  }) => Promise<ActionResult>;
};

export type ActionResult =
  | {
      ok: true;
    }
  | {
      ok: false;
      message: string;
    };

export const useStorefrontPuck = createUsePuck();
export const HISTORY_LIMIT = 60;
export const HISTORY_COMMIT_DELAY_MS = 700;
export const FONT_OPTIONS = [
  "Syne",
  "Outfit",
  "Inter",
  "Geist",
  "Manrope",
  "DM Sans",
  "Nunito Sans",
  "Source Sans 3",
] as const;

const GOOGLE_FONT_SPECS: Record<string, string> = {
  Syne: "Syne:wght@500;600;700;800",
  Outfit: "Outfit:wght@400;500;600;700",
  Inter: "Inter:wght@400;500;600;700",
  Geist: "Geist:wght@400;500;600;700",
  Manrope: "Manrope:wght@400;500;600;700",
  "DM Sans": "DM+Sans:wght@400;500;600;700",
  "Nunito Sans": "Nunito+Sans:wght@400;500;600;700",
  "Source Sans 3": "Source+Sans+3:wght@400;500;600;700",
};

/** Google Fonts stylesheet URL for the given face names. */
export function storefrontGoogleFontsHref(names: readonly string[]) {
  const seen = new Set<string>();
  const families: string[] = [];
  for (const name of names) {
    const spec = GOOGLE_FONT_SPECS[name];
    if (spec && !seen.has(spec)) {
      seen.add(spec);
      families.push(spec);
    }
  }
  if (families.length === 0) return null;
  return `https://fonts.googleapis.com/css2?${families.map((f) => `family=${f}`).join("&")}&display=swap`;
}

/** Inject catalog font faces for UI previews. */
export function ensureStorefrontFontOptionsLoaded() {
  if (typeof document === "undefined") return;
  const id = "ecs-storefront-font-options";
  if (document.getElementById(id)) return;
  const href = storefrontGoogleFontsHref(FONT_OPTIONS);
  if (!href) return;
  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href = href;
  document.head.appendChild(link);
}
export const POPOVER_MOTION_CLASSNAME =
  "w-72 p-3 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2";
export const SETTINGS_SECTION_LABELS: Record<string, string> = {
  announcement: "Top Bar",
  header: "Brand",
  hero: "Hero",
  "featured-collection": "Featured collection",
  "featured-products": "Products",
  "collections-strip": "Collections strip",
  trust: "Trust row",
  testimonials: "Testimonials",
  footer: "Footer",
  theme: "Appearance",
};
