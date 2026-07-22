import { classicV1EditorSchema as classicV1EditorManifest } from "@ecs/storefront-templates";
import type { Data } from "@puckeditor/core";

export type StorefrontDraft = {
  data: unknown;
  templateKey: string;
  templateVersion: number;
  tenantId: string;
  themeTokens: unknown;
  updatedAt: string;
  published?:
    | {
        revisionId: string;
        publishedAt: string;
        data: unknown;
        themeTokens: unknown;
      }
    | null
    | undefined;
};

export type StorefrontPageProps = {
  announcementEnabled?: boolean;
  announcementText?: string;
  backgroundColor?: string;
  bodyFont?: string;
  collectionsStripEnabled?: boolean;
  collectionsStripTitle?: string;
  featuredCollectionEnabled?: boolean;
  featuredCollectionId?: string;
  featuredCollectionTitle?: string;
  featuredProductIds?: string[];
  featuredProductsEnabled?: boolean;
  footerAddress?: string;
  footerPhone?: string;
  foregroundColor?: string;
  headingFont?: string;
  heroEnabled?: boolean;
  heroImageAssetId?: string;
  heroSubtitle?: string;
  heroTitle?: string;
  logoAssetId?: string;
  mutedColor?: string;
  navigationHref?: string;
  navigationLabel?: string;
  primaryColor?: string;
  primaryCtaHref?: string;
  primaryCtaLabel?: string;
  productSectionTitle?: string;
  testimonialsEnabled?: boolean;
  testimonialsTitle?: string;
  trustEnabled?: boolean;
  accentColor?: string;
};

export type PublicationStatus = "published" | "saved-draft" | "unsaved";

export const STOREFRONT_PAGE_COMPONENT = "StorefrontPage";

export function buildPuckData(draft: StorefrontDraft): Data {
  return {
    content: [
      {
        props: {
          ...flattenDraft(draft.data, draft.themeTokens),
          id: "storefront-page",
        },
        type: STOREFRONT_PAGE_COMPONENT,
      },
    ],
    root: {},
  };
}

export function buildDraftPayload(input: {
  data: unknown;
  editorData: Data;
  tenantId: string;
  themeTokens: unknown;
}) {
  const data = cloneJson(input.data) as Record<string, unknown>;
  const themeTokens = cloneJson(input.themeTokens) as Record<string, unknown>;
  const props = getStorefrontPageProps(input.editorData);

  for (const section of classicV1EditorManifest.sections) {
    for (const field of section.fields) {
      const value = (props as Record<string, unknown>)[field.prop];
      const draftValue = coerceFieldValue(field.kind, value);

      if (field.path.startsWith("themeTokens.")) {
        setPathValue(themeTokens, field.path.replace(/^themeTokens\./, ""), draftValue);
      } else {
        setPathValue(data, field.path, draftValue);
      }
    }
  }

  return {
    data,
    tenantId: input.tenantId,
    themeTokens,
  };
}

export function getStorefrontPageProps(editorData: Data): StorefrontPageProps {
  const item = editorData.content.find((entry) => entry.type === STOREFRONT_PAGE_COMPONENT);

  return (item?.props ?? {}) as StorefrontPageProps;
}

export function serializeEditorData(data: Data) {
  return JSON.stringify(getStorefrontPageProps(data));
}

export function getPublicationStatus({
  currentSnapshot,
  publishedSnapshot,
  savedSnapshot,
}: {
  currentSnapshot: string;
  publishedSnapshot: string | null;
  savedSnapshot: string;
}): PublicationStatus {
  if (publishedSnapshot && currentSnapshot === publishedSnapshot) {
    return "published";
  }

  if (currentSnapshot === savedSnapshot) {
    return "saved-draft";
  }

  return "unsaved";
}

export function isPreviewImageUrl(value: string | undefined) {
  if (!value) {
    return false;
  }

  return /^https?:\/\//i.test(value) || /^data:image\//i.test(value);
}

function coerceFieldValue(kind: string, value: unknown): unknown {
  if (kind === "boolean") {
    if (typeof value === "boolean") return value;
    if (value === "true" || value === "1") return true;
    if (value === "false" || value === "0") return false;
    return Boolean(value);
  }

  if (kind === "products") {
    if (Array.isArray(value)) {
      return value.map(String).filter((id) => id.trim().length > 0);
    }
    if (typeof value === "string") {
      return value
        .split(/[\n,]+/)
        .map((part) => part.trim())
        .filter(Boolean);
    }
    return [];
  }

  if (kind === "collection") {
    const id = typeof value === "string" ? value.trim() : value == null ? "" : String(value);
    return id || undefined;
  }

  if (kind === "image") {
    const text = value == null ? "" : String(value);
    return text.trim() ? text : undefined;
  }

  return value == null ? "" : String(value);
}

function flattenDraft(data: unknown, themeTokens: unknown): StorefrontPageProps {
  const props: Record<string, unknown> = {};

  for (const section of classicV1EditorManifest.sections) {
    for (const field of section.fields) {
      const raw = getPathValue(
        field.path.startsWith("themeTokens.") ? themeTokens : data,
        field.path.replace(/^themeTokens\./, ""),
      );
      props[field.prop] = normalizePropForEditor(field.kind, raw);
    }
  }

  return props as StorefrontPageProps;
}

function normalizePropForEditor(kind: string, value: unknown): unknown {
  if (kind === "boolean") {
    return typeof value === "boolean" ? value : value == null ? true : Boolean(value);
  }
  if (kind === "products") {
    return Array.isArray(value) ? value.map(String) : [];
  }
  if (kind === "collection") {
    return typeof value === "string" ? value : value == null ? "" : String(value);
  }
  return typeof value === "string" ? value : value == null ? undefined : String(value);
}

function getPathValue(source: unknown, path: string) {
  return path.split(".").reduce<unknown>((current, key) => {
    if (current === null || typeof current !== "object") {
      return undefined;
    }

    return (current as Record<string, unknown>)[key];
  }, source);
}

function setPathValue(target: unknown, path: string, value: unknown) {
  if (target === null || typeof target !== "object") {
    return;
  }

  const segments = path.split(".");
  let current: Record<string, unknown> = target as Record<string, unknown>;

  segments.slice(0, -1).forEach((segment, index) => {
    const next = current[segment];

    if (next === null || typeof next !== "object") {
      current[segment] = isNumericSegment(segments[index + 1] ?? "") ? [] : {};
    }

    current = current[segment] as Record<string, unknown>;
  });

  current[segments[segments.length - 1] ?? ""] = value;
}

function cloneJson(value: unknown) {
  return JSON.parse(JSON.stringify(value ?? {})) as unknown;
}

function isNumericSegment(segment: string) {
  return /^\d+$/.test(segment);
}
