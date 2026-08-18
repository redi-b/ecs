import {
  generateThemeFromPrimary,
  getStorefrontEditorManifest,
  getStorefrontTemplateDefinition,
  inferSurfaceMode,
  type ThemePaletteSeed,
  type ThemeSurfaceMode,
} from "@ecs/storefront-templates";
export type EditorData = {
  content: Array<{
    props: Record<string, unknown> & { id: string };
    type: string;
  }>;
  root: { props?: Record<string, unknown> };
};

export type EditorAction = { data: EditorData; type: "setData" };

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
        templateKey: string;
        data: unknown;
        themeTokens: unknown;
      }
    | null
    | undefined;
};

export type StorefrontPageProps = {
  [key: string]: unknown;
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
  heroFeaturedProductIds?: string[];
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
  /** light | dark: base for auto palette generation */
  surfaceMode?: "light" | "dark";
  /** When true, brand + surface regenerate the full palette */
  autoPalette?: boolean;
  testimonialsEnabled?: boolean;
  testimonialsTitle?: string;
  trustEnabled?: boolean;
  accentColor?: string;
};

export type PublicationStatus = "published" | "saved-draft" | "unsaved";

export const STOREFRONT_PAGE_COMPONENT = "StorefrontPage";

export function buildEditorData(draft: StorefrontDraft): EditorData {
  return {
    content: [
      {
        props: {
          ...flattenDraft(draft.data, draft.themeTokens, draft.templateKey),
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
  editorData: EditorData;
  templateKey: string;
  tenantId: string;
  themeTokens: unknown;
}) {
  const data = cloneJson(input.data) as Record<string, unknown>;
  const themeTokens = cloneJson(input.themeTokens) as Record<string, unknown>;
  const props = getStorefrontPageProps(input.editorData);

  const manifest = requireEditorManifest(input.templateKey);
  for (const section of manifest.sections) {
    for (const field of section.fields) {
      const value = (props as Record<string, unknown>)[field.prop];
      const draftValue = coerceFieldValue(field.kind, value);

      if (field.path.startsWith("themeTokens.")) {
        setPathValue(themeTokens, field.path.replace(/^themeTokens\./, ""), draftValue);
      } else {
        setPathValue(data, field.path, draftValue);
        field.deprecatedPaths?.forEach((path) => deletePathValue(data, path));
      }
    }
  }

  // Palette fields may be generated (not all listed as editor fields). Persist from props.
  const mode =
    props.surfaceMode === "light" || props.surfaceMode === "dark"
      ? props.surfaceMode
      : inferSurfaceMode(props.backgroundColor);
  setPathValue(themeTokens, "surfaceMode", mode);
  setPathValue(
    themeTokens,
    "autoPalette",
    typeof props.autoPalette === "boolean" ? props.autoPalette : true,
  );
  if (props.primaryColor) setPathValue(themeTokens, "colors.primary", props.primaryColor);
  if (props.backgroundColor) setPathValue(themeTokens, "colors.background", props.backgroundColor);
  if (props.foregroundColor) setPathValue(themeTokens, "colors.foreground", props.foregroundColor);
  if (props.mutedColor) setPathValue(themeTokens, "colors.muted", props.mutedColor);
  if (props.accentColor) setPathValue(themeTokens, "colors.accent", props.accentColor);

  return {
    data,
    tenantId: input.tenantId,
    themeTokens,
  };
}

export function getStorefrontPageProps(editorData: EditorData): StorefrontPageProps {
  const item = editorData.content.find((entry) => entry.type === STOREFRONT_PAGE_COMPONENT);

  return (item?.props ?? {}) as StorefrontPageProps;
}

export function serializeEditorData(data: EditorData) {
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

export function updateEditorLinkValue(
  current: unknown,
  fieldPath: string,
  changedPath: string,
  value: string,
) {
  if (!Array.isArray(current) || !changedPath.startsWith(`${fieldPath}.`)) return null;
  const [rawIndex, key] = changedPath.slice(fieldPath.length + 1).split(".");
  const index = Number.parseInt(rawIndex ?? "", 10);
  if (!Number.isInteger(index) || (key !== "label" && key !== "href")) return null;
  return current.map((item, itemIndex) =>
    itemIndex === index && item && typeof item === "object"
      ? { ...(item as Record<string, unknown>), [key]: value }
      : item,
  );
}

function coerceFieldValue(kind: string, value: unknown): unknown {
  if (kind === "boolean") {
    if (typeof value === "boolean") return value;
    if (value === "true" || value === "1") return true;
    if (value === "false" || value === "0") return false;
    return Boolean(value);
  }

  if (kind === "products" || kind === "collections") {
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

  if (kind === "product") {
    const id = Array.isArray(value) ? value[0] : value;
    const text = id == null ? "" : String(id).trim();
    return text || undefined;
  }

  if (kind === "links") {
    if (!Array.isArray(value)) return [];
    return value
      .map((item) => {
        const candidate = item && typeof item === "object" ? item as Record<string, unknown> : {};
        return {
          label: typeof candidate.label === "string" ? candidate.label.trim() : "",
          href: typeof candidate.href === "string" ? candidate.href.trim() : "",
        };
      })
      .filter((item) => item.label && item.href);
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

function normalizePropForEditor(kind: string, value: unknown): unknown {
  if (kind === "boolean") {
    return typeof value === "boolean" ? value : value == null ? true : Boolean(value);
  }
  if (kind === "products" || kind === "collections") {
    return Array.isArray(value) ? value.map(String) : [];
  }
  if (kind === "product") {
    return typeof value === "string" ? value : "";
  }
  if (kind === "links") {
    if (!Array.isArray(value)) return [];
    return value.map((item) => {
      const candidate = item && typeof item === "object" ? item as Record<string, unknown> : {};
      return {
        label: typeof candidate.label === "string" ? candidate.label : "",
        href: typeof candidate.href === "string" ? candidate.href : "",
      };
    });
  }
  if (kind === "collection") {
    return typeof value === "string" ? value : value == null ? "" : String(value);
  }
  return typeof value === "string" ? value : value == null ? undefined : String(value);
}

function flattenDraft(data: unknown, themeTokens: unknown, templateKey = "luvia@1"): StorefrontPageProps {
  const props: Record<string, unknown> = {};

  const manifest = requireEditorManifest(templateKey);
  for (const section of manifest.sections) {
    for (const field of section.fields) {
      const raw = getPathValue(
        field.path.startsWith("themeTokens.") ? themeTokens : data,
        field.path.replace(/^themeTokens\./, ""),
      );
      props[field.prop] = normalizePropForEditor(field.kind, raw);
    }
  }

  // Always expose generated palette fields for preview (even if not in editor manifest).
  const tokens =
    themeTokens && typeof themeTokens === "object"
      ? (themeTokens as {
          surfaceMode?: string;
          colors?: Record<string, string | undefined>;
        })
      : {};
  const colors = tokens.colors ?? {};
  props.backgroundColor =
    typeof colors.background === "string" ? colors.background : props.backgroundColor;
  props.foregroundColor =
    typeof colors.foreground === "string" ? colors.foreground : props.foregroundColor;
  props.primaryColor =
    typeof colors.primary === "string" ? colors.primary : props.primaryColor;
  props.mutedColor = typeof colors.muted === "string" ? colors.muted : props.mutedColor;
  props.accentColor = typeof colors.accent === "string" ? colors.accent : props.accentColor;
  props.surfaceMode =
    tokens.surfaceMode === "light" || tokens.surfaceMode === "dark"
      ? tokens.surfaceMode
      : inferSurfaceMode(typeof colors.background === "string" ? colors.background : undefined);
  props.autoPalette =
    typeof (tokens as { autoPalette?: unknown }).autoPalette === "boolean"
      ? (tokens as { autoPalette: boolean }).autoPalette
      : true;

  return props as StorefrontPageProps;
}

function requireEditorManifest(templateKey: string) {
  const manifest = getStorefrontEditorManifest(templateKey);
  if (!manifest) {
    throw new Error(`No editor manifest is registered for ${templateKey}.`);
  }
  return manifest;
}

/** Build page props patch for a full palette from brand color + surface mode. */
export function themePalettePageProps(
  primary: string,
  mode: ThemeSurfaceMode,
  templateKey?: string,
): Partial<StorefrontPageProps> {
  const definition = templateKey ? getStorefrontTemplateDefinition(templateKey) : undefined;
  const manifest = templateKey ? getStorefrontEditorManifest(templateKey) : undefined;
  const defaults = definition?.defaultThemeTokens as {
    colors?: Partial<ThemePaletteSeed["colors"]>;
  } | undefined;
  const colors = defaults?.colors;
  const seed = colors?.primary && colors.background && colors.foreground && colors.muted && colors.accent
      ? {
        id: `${templateKey ?? "template"}-${mode}`,
        surfaceMode: mode,
        ...(manifest?.theme?.paletteStrategy
          ? { strategy: manifest.theme.paletteStrategy }
          : {}),
        colors: {
          primary: colors.primary,
          background: colors.background,
          foreground: colors.foreground,
          muted: colors.muted,
          accent: colors.accent,
        },
      } satisfies ThemePaletteSeed
    : undefined;
  const generated = generateThemeFromPrimary(primary, mode, seed);
  return {
    surfaceMode: mode,
    autoPalette: true,
    primaryColor: generated.primary,
    backgroundColor: generated.background,
    foregroundColor: generated.foreground,
    mutedColor: generated.muted,
    accentColor: generated.accent,
  };
}

/** Restore designed defaults for the current surface (seed colors, auto on). */
export function themeResetPageProps(templateKey: string): Partial<StorefrontPageProps> {
  const definition = getStorefrontTemplateDefinition(templateKey);
  const tokens = definition?.defaultThemeTokens as {
    autoPalette?: boolean;
    colors?: Record<string, string | undefined>;
    surfaceMode?: string;
    colorMode?: string;
    typography?: Record<string, string | undefined>;
  } | undefined;
  const colors = tokens?.colors ?? {};
  const typography = tokens?.typography ?? {};
  const backgroundColor = colors.background;

  const reset: Partial<StorefrontPageProps> = {
    autoPalette: tokens?.autoPalette ?? true,
    surfaceMode:
      tokens?.surfaceMode === "dark" || tokens?.colorMode === "dark"
        ? "dark"
        : tokens?.surfaceMode === "light" || tokens?.colorMode === "light"
          ? "light"
          : inferSurfaceMode(backgroundColor),
  };
  if (colors.accent) reset.accentColor = colors.accent;
  if (backgroundColor) reset.backgroundColor = backgroundColor;
  if (typography.bodyFont) reset.bodyFont = typography.bodyFont;
  if (colors.foreground) reset.foregroundColor = colors.foreground;
  if (typography.headingFont) reset.headingFont = typography.headingFont;
  if (colors.muted) reset.mutedColor = colors.muted;
  if (colors.primary) reset.primaryColor = colors.primary;
  return reset;
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

function deletePathValue(target: unknown, path: string) {
  if (target === null || typeof target !== "object") return;
  const segments = path.split(".");
  const parent = segments.slice(0, -1).reduce<unknown>((current, segment) => {
    if (current === null || typeof current !== "object") return undefined;
    return (current as Record<string, unknown>)[segment];
  }, target);
  if (parent && typeof parent === "object") {
    delete (parent as Record<string, unknown>)[segments.at(-1) ?? ""];
  }
}

function cloneJson(value: unknown) {
  return JSON.parse(JSON.stringify(value ?? {})) as unknown;
}

function isNumericSegment(segment: string) {
  return /^\d+$/.test(segment);
}
