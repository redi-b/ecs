import { marked } from "marked";
import sanitizeHtml from "sanitize-html";

const PRODUCT_DESCRIPTION_TAGS = [
  "p",
  "br",
  "hr",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "ul",
  "ol",
  "li",
  "strong",
  "b",
  "em",
  "i",
  "s",
  "del",
  "code",
  "pre",
  "blockquote",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
  "a",
  "img",
] as const;

/**
 * Canonical trust-boundary sanitizer for merchant-authored product descriptions.
 * Converts markdown / rich-text to safe HTML and remains compatible with Medusa's
 * native string description field.
 */
export function sanitizeProductDescription(value: string | null | undefined): string | null {
  const source = value?.trim();
  if (!source) return null;

  const rawHtml = marked.parse(source, {
    gfm: true,
    breaks: false,
    async: false,
  }) as string;

  const sanitized = sanitizeHtml(rawHtml, {
    allowedAttributes: {
      a: ["href", "target", "rel"],
      img: ["src", "alt", "title"],
      th: ["align"],
      td: ["align"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    allowedSchemesAppliedToAttributes: ["href", "src"],
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
      tagName === "p" ||
      tagName === "li" ||
      tagName === "h1" ||
      tagName === "h2" ||
      tagName === "h3" ||
      tagName === "h4" ||
      tagName === "th" ||
      tagName === "td"
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
