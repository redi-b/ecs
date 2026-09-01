import sanitizeHtml from "sanitize-html";

const PRODUCT_DESCRIPTION_TAGS = [
  "p",
  "br",
  "h2",
  "h3",
  "ul",
  "ol",
  "li",
  "strong",
  "em",
  "s",
  "blockquote",
  "a",
] as const;

/**
 * Canonical trust-boundary sanitizer for merchant-authored product descriptions.
 * The result is safe to render as HTML and remains compatible with Medusa's
 * native string description field.
 */
export function sanitizeProductDescription(value: string | null | undefined): string | null {
  const source = value?.trim();
  if (!source) return null;

  const sanitized = sanitizeHtml(source, {
    allowedAttributes: { a: ["href"] },
    allowedSchemes: ["http", "https", "mailto"],
    allowedSchemesAppliedToAttributes: ["href"],
    allowedTags: [...PRODUCT_DESCRIPTION_TAGS],
    allowProtocolRelative: false,
    disallowedTagsMode: "discard",
    enforceHtmlBoundary: true,
  }).trim();

  return sanitized || null;
}

/** Plain-text projection for search, metadata, and non-rich UI surfaces. */
export function productDescriptionToText(value: string | null | undefined): string {
  const sanitized = sanitizeProductDescription(value);
  if (!sanitized) return "";

  const text = sanitizeHtml(sanitized, {
    allowedAttributes: {},
    allowedTags: [],
    textFilter: (chunk, tagName) =>
      tagName === "p" || tagName === "li" || tagName === "h2" || tagName === "h3"
        ? ` ${chunk}`
        : chunk,
  });

  return decodeHtmlEntities(text)
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim();
}

function decodeHtmlEntities(value: string) {
  return value.replace(/&(?:#(\d+)|#x([\da-f]+)|([a-z]+));/gi, (entity, decimal, hex, named) => {
    if (decimal) return String.fromCodePoint(Number(decimal));
    if (hex) return String.fromCodePoint(Number.parseInt(hex, 16));
    const entities: Record<string, string> = {
      amp: "&",
      apos: "'",
      gt: ">",
      lt: "<",
      nbsp: " ",
      quot: '"',
    };
    return entities[String(named).toLowerCase()] ?? entity;
  });
}
