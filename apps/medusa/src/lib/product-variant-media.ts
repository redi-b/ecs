/** Validate persisted metadata without coupling Medusa's NodeNext build to API contracts. */
function readBindings(
  value: unknown,
): { optionTitle: string; mappings: Record<string, string[]> } | null {
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.optionTitle !== "string" ||
    !candidate.optionTitle.trim() ||
    !candidate.mappings ||
    typeof candidate.mappings !== "object" ||
    Array.isArray(candidate.mappings)
  )
    return null;
  const mappings: Record<string, string[]> = Object.create(null);
  for (const [key, urls] of Object.entries(candidate.mappings)) {
    if (!Array.isArray(urls) || !urls.every((url): url is string => typeof url === "string"))
      return null;
    mappings[key] = urls;
  }
  return { optionTitle: candidate.optionTitle, mappings };
}

type ProductMediaState = {
  thumbnail?: string | null;
  images?: Array<{ url?: string | null }>;
  metadata?: Record<string, unknown> | null;
  variants?: Array<{
    id: string;
    metadata?: Record<string, unknown> | null;
    options?: Array<{
      value?: string | null;
      option?: { title?: string | null } | null;
    }>;
  }>;
};

/** Build metadata-only patches from the product as it exists at save time. */
export function getVariantImageUpdates(product: ProductMediaState) {
  const bindings = readBindings(product.metadata?.option_media_bindings);
  const gallery = new Set(
    [product.thumbnail, ...(product.images ?? []).map((image) => image.url)]
      .filter((url): url is string => typeof url === "string" && Boolean(url.trim()))
      .map((url) => url.trim()),
  );

  return (product.variants ?? []).flatMap((variant) => {
    const metadata = variant.metadata ?? {};
    const existing = typeof metadata.image_url === "string" ? metadata.image_url.trim() : null;
    const source = metadata.image_source;
    // Preserve old explicit photos whose origin was never recorded.
    if (existing && source !== "option" && source !== "manual") return [];
    // A variant-only upload need not belong to the shared product gallery.
    // Only an explicit variant edit may clear a manually chosen photo.
    if (existing && source === "manual") return [];

    const value = bindings
      ? variant.options?.find((item) => item.option?.title === bindings.optionTitle)?.value
      : undefined;
    const image = value
      ? (bindings?.mappings[value]?.find((url) => gallery.has(url)) ?? null)
      : null;
    const imageSource = image ? "option" : null;
    if ((existing || null) === image && (source ?? null) === imageSource) return [];

    return [
      {
        id: variant.id,
        metadata: { ...metadata, image_url: image, image_source: imageSource },
      },
    ];
  });
}

export function productUpdateChangesMedia(update: Record<string, unknown>) {
  return (
    Object.hasOwn(update, "images") ||
    Object.hasOwn(update, "thumbnail") ||
    (typeof update.metadata === "object" &&
      update.metadata !== null &&
      Object.hasOwn(update.metadata, "option_media_bindings"))
  );
}
