import type { Data } from "@puckeditor/core";

import { classicV1EditorSchema as classicV1EditorManifest } from "@ecs/storefront-templates";

export type StorefrontDraft = {
  data: unknown;
  templateKey: string;
  templateVersion: number;
  tenantId: string;
  themeTokens: unknown;
  updatedAt: string;
  published?: {
    revisionId: string;
    publishedAt: string;
    data: unknown;
    themeTokens: unknown;
  } | null | undefined;
};

export type StorefrontPageProps = {
  announcementText?: string;
  backgroundColor?: string;
  bodyFont?: string;
  footerAddress?: string;
  footerPhone?: string;
  foregroundColor?: string;
  headingFont?: string;
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
  const data = cloneJson(input.data) as Record<string, any>;
  const themeTokens = cloneJson(input.themeTokens) as Record<string, any>;
  const props = getStorefrontPageProps(input.editorData);

  for (const section of classicV1EditorManifest.sections) {
    for (const field of section.fields) {
      const value = (props as Record<string, unknown>)[field.prop];
      const draftValue =
        field.kind === "image" && !String(value ?? "").trim() ? undefined : String(value ?? "");

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

function flattenDraft(data: unknown, themeTokens: unknown): StorefrontPageProps {
  const props: Record<string, string | undefined> = {};

  for (const section of classicV1EditorManifest.sections) {
    for (const field of section.fields) {
      props[field.prop] = getPathValue(
        field.path.startsWith("themeTokens.") ? themeTokens : data,
        field.path.replace(/^themeTokens\./, ""),
      );
    }
  }

  return props;
}

function getPathValue(source: unknown, path: string) {
  const value = path.split(".").reduce<unknown>((current, key) => {
    if (current === null || typeof current !== "object") {
      return undefined;
    }

    return (current as Record<string, unknown>)[key];
  }, source);

  return typeof value === "string" ? value : undefined;
}

function setPathValue(target: unknown, path: string, value: string | undefined) {
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
