const COLOR_OPTION_TITLE = /^colou?r$/i;

const NAMED_SWATCHES: Readonly<Record<string, string>> = {
  black: "#17181c",
  white: "#f4f2ec",
  gray: "#707780",
  grey: "#707780",
  silver: "#b8bcc2",
  charcoal: "#34383e",
  blue: "#527d9b",
  navy: "#24364f",
  teal: "#397979",
  cyan: "#4ca6b6",
  red: "#9c4d4d",
  maroon: "#713f46",
  orange: "#c87942",
  green: "#63765c",
  olive: "#77774f",
  yellow: "#d1b75c",
  gold: "#b89545",
  purple: "#756685",
  violet: "#77639a",
  pink: "#c08496",
  brown: "#775f51",
  tan: "#b79b77",
  beige: "#c9bda7",
  cream: "#e9e0c8",
  ivory: "#e6e1d5",
  sage: "#89957e",
  blush: "#c99da2",
};

export const isColorOptionTitle = (title: string): boolean => COLOR_OPTION_TITLE.test(title.trim());

/**
 * Resolves only truthful, order-independent swatches. Unknown merchandising
 * names deliberately return null so the UI can retain a readable text option.
 */
export const resolveColorSwatch = (value: string, explicitSwatch?: string | null): string | null => {
  const normalizedExplicit = explicitSwatch?.trim().toLowerCase();
  if (normalizedExplicit && /^#[\da-f]{6}$/.test(normalizedExplicit)) {
    return normalizedExplicit;
  }

  const normalized = value.trim().toLowerCase();
  const embeddedHex = normalized.match(/(?:^|\s)(#[\da-f]{3,4}|#[\da-f]{6}|#[\da-f]{8})(?:\s|$)/i)?.[1];
  if (embeddedHex) return embeddedHex;

  const words = normalized.split(/[^a-z]+/).filter(Boolean);
  for (const word of words) {
    const swatch = NAMED_SWATCHES[word];
    if (swatch) return swatch;
  }
  return null;
};
