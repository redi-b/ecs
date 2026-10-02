import type { EditorData } from "./editor-state";
import { serializeEditorData } from "./editor-state";

export const STOREFRONT_EDITOR_PENDING_STORAGE_PREFIX = "ecs:storefront-editor:pending";
export const STOREFRONT_TRANSLATIONS_PENDING_STORAGE_PREFIX = "ecs:storefront-translations:pending";

export type StoredPendingDraft = {
  editorData: EditorData;
  snapshot: string;
  templateKey: string;
  tenantId: string;
  updatedAt: number;
};

export type StoredPendingTranslations = {
  locale: string;
  reviewedPaths: string[];
  tenantId: string;
  updatedAt: number;
  values: Record<string, string>;
};

export function getPendingDraftStorageKey(tenantId: string, templateKey: string): string {
  return `${STOREFRONT_EDITOR_PENDING_STORAGE_PREFIX}:${tenantId}:${templateKey}`;
}

export function getPendingTranslationsStorageKey(tenantId: string, locale: string): string {
  return `${STOREFRONT_TRANSLATIONS_PENDING_STORAGE_PREFIX}:${tenantId}:${locale}`;
}

export function loadPendingDraft(
  tenantId: string,
  templateKey: string,
  storage: Pick<Storage, "getItem" | "removeItem"> = window.localStorage,
): EditorData | null {
  try {
    const raw = storage.getItem(getPendingDraftStorageKey(tenantId, templateKey));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredPendingDraft>;
    if (
      !parsed ||
      typeof parsed !== "object" ||
      parsed.tenantId !== tenantId ||
      parsed.templateKey !== templateKey ||
      !parsed.editorData
    ) {
      return null;
    }
    return parsed.editorData;
  } catch {
    return null;
  }
}

export function savePendingDraft(
  tenantId: string,
  templateKey: string,
  editorData: EditorData,
  storage: Pick<Storage, "setItem"> = window.localStorage,
): void {
  try {
    const snapshot = serializeEditorData(editorData);
    const payload: StoredPendingDraft = {
      editorData,
      snapshot,
      templateKey,
      tenantId,
      updatedAt: Date.now(),
    };
    storage.setItem(getPendingDraftStorageKey(tenantId, templateKey), JSON.stringify(payload));
  } catch {
    // Ignore storage quota or access errors
  }
}

export function clearPendingDraft(
  tenantId: string,
  templateKey: string,
  storage: Pick<Storage, "removeItem"> = window.localStorage,
): void {
  try {
    storage.removeItem(getPendingDraftStorageKey(tenantId, templateKey));
  } catch {
    // Ignore storage access errors
  }
}

export function loadPendingTranslations(
  tenantId: string,
  locale: string,
  storage: Pick<Storage, "getItem"> = window.localStorage,
): { reviewedPaths: string[]; values: Record<string, string> } | null {
  try {
    const raw = storage.getItem(getPendingTranslationsStorageKey(tenantId, locale));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredPendingTranslations>;
    if (
      !parsed ||
      typeof parsed !== "object" ||
      parsed.tenantId !== tenantId ||
      parsed.locale !== locale ||
      !parsed.values
    ) {
      return null;
    }
    return {
      reviewedPaths: Array.isArray(parsed.reviewedPaths) ? parsed.reviewedPaths : [],
      values: parsed.values,
    };
  } catch {
    return null;
  }
}

export function savePendingTranslations(
  tenantId: string,
  locale: string,
  values: Record<string, string>,
  reviewedPaths: string[],
  storage: Pick<Storage, "setItem"> = window.localStorage,
): void {
  try {
    const payload: StoredPendingTranslations = {
      locale,
      reviewedPaths,
      tenantId,
      updatedAt: Date.now(),
      values,
    };
    storage.setItem(getPendingTranslationsStorageKey(tenantId, locale), JSON.stringify(payload));
  } catch {
    // Ignore storage quota or access errors
  }
}

export function clearPendingTranslations(
  tenantId: string,
  locale: string,
  storage: Pick<Storage, "removeItem"> = window.localStorage,
): void {
  try {
    storage.removeItem(getPendingTranslationsStorageKey(tenantId, locale));
  } catch {
    // Ignore storage access errors
  }
}
