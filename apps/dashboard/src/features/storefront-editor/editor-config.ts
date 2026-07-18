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
];
export const POPOVER_MOTION_CLASSNAME =
  "w-72 p-3 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2";
export const SETTINGS_SECTION_LABELS: Record<string, string> = {
  announcement: "Top Bar",
  header: "Brand",
  hero: "Hero",
  "featured-products": "Products",
  footer: "Footer",
  theme: "Theme",
};
