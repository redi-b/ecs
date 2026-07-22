/**
 * Merchant-friendly theme generation: pick a primary (+ light/dark surface)
 * and derive the full color set with contrast-safe text colors.
 */

export type ThemeSurfaceMode = "light" | "dark";

export type GeneratedThemeColors = {
  background: string;
  foreground: string;
  primary: string;
  muted: string;
  accent: string;
  /** Text/icon color on primary buttons */
  onPrimary: string;
  /** Text/icon color on accent */
  onAccent: string;
};

export type Hsl = { h: number; s: number; l: number };

const HEX_RE = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

export function normalizeHex(input: string, fallback = "#0f766e"): string {
  const raw = input.trim();
  const match = HEX_RE.exec(raw);
  if (!match) return fallback.startsWith("#") ? fallback.toLowerCase() : `#${fallback.toLowerCase()}`;
  let body = match[1]!.toLowerCase();
  if (body.length === 3) {
    body = body
      .split("")
      .map((c) => c + c)
      .join("");
  }
  return `#${body}`;
}

export function isHexColor(value: string): boolean {
  return HEX_RE.test(value.trim());
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const normalized = normalizeHex(hex, "");
  if (!normalized || normalized.length !== 7) return null;
  const n = Number.parseInt(normalized.slice(1), 16);
  if (!Number.isFinite(n)) return null;
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return `#${[clamp(r), clamp(g), clamp(b)]
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("")}`;
}

export function hexToHsl(hex: string): Hsl | null {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: l * 100 };

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  switch (max) {
    case r:
      h = (g - b) / d + (g < b ? 6 : 0);
      break;
    case g:
      h = (b - r) / d + 2;
      break;
    default:
      h = (r - g) / d + 4;
      break;
  }
  h /= 6;
  return { h: h * 360, s: s * 100, l: l * 100 };
}

function hueToRgb(p: number, q: number, t: number) {
  let tt = t;
  if (tt < 0) tt += 1;
  if (tt > 1) tt -= 1;
  if (tt < 1 / 6) return p + (q - p) * 6 * tt;
  if (tt < 1 / 2) return q;
  if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
  return p;
}

export function hslToHex(h: number, s: number, l: number): string {
  const hh = ((h % 360) + 360) % 360;
  const ss = Math.max(0, Math.min(100, s)) / 100;
  const ll = Math.max(0, Math.min(100, l)) / 100;
  if (ss === 0) {
    const v = ll * 255;
    return rgbToHex(v, v, v);
  }
  const q = ll < 0.5 ? ll * (1 + ss) : ll + ss - ll * ss;
  const p = 2 * ll - q;
  const hk = hh / 360;
  const r = hueToRgb(p, q, hk + 1 / 3) * 255;
  const g = hueToRgb(p, q, hk) * 255;
  const b = hueToRgb(p, q, hk - 1 / 3) * 255;
  return rgbToHex(r, g, b);
}

/** Relative luminance 0–1 (sRGB). */
export function relativeLuminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  const lin = [rgb.r, rgb.g, rgb.b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * lin[0]! + 0.7152 * lin[1]! + 0.0722 * lin[2]!;
}

/** WCAG contrast ratio between two hex colors. */
export function contrastRatio(a: string, b: string): number {
  const l1 = relativeLuminance(a);
  const l2 = relativeLuminance(b);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Pick black or white (or near) for text on a solid fill. */
export function contrastingInk(fillHex: string): string {
  const fill = normalizeHex(fillHex);
  const white = "#ffffff";
  const black = "#0b0f0d";
  return contrastRatio(fill, white) >= contrastRatio(fill, black) ? white : black;
}

/**
 * Infer light vs dark surface from an existing background color.
 * Used when migrating drafts that only have free-form colors.
 */
export function inferSurfaceMode(backgroundHex: string | undefined | null): ThemeSurfaceMode {
  if (!backgroundHex || !isHexColor(backgroundHex)) return "dark";
  return relativeLuminance(normalizeHex(backgroundHex)) > 0.45 ? "light" : "dark";
}

/**
 * Build a full classic theme color set from a brand primary + surface mode.
 * Merchants only need to pick primary (and light/dark); everything else is derived.
 */
export function generateThemeFromPrimary(
  primaryInput: string,
  mode: ThemeSurfaceMode = "dark",
): GeneratedThemeColors {
  const primary = normalizeHex(primaryInput, "#9bc4a0");
  const hsl = hexToHsl(primary) ?? { h: 140, s: 28, l: 68 };

  // Keep primary readable: nudge lightness if extreme.
  let primaryL = hsl.l;
  if (mode === "light" && primaryL > 72) primaryL = 58;
  if (mode === "light" && primaryL < 28) primaryL = 38;
  if (mode === "dark" && primaryL < 35) primaryL = 48;
  if (mode === "dark" && primaryL > 82) primaryL = 62;
  const primaryAdj = hslToHex(hsl.h, Math.min(hsl.s, 72), primaryL);

  // Accent: warm shift from brand hue for CTAs/highlights.
  const accentH = (hsl.h + 28) % 360;
  const accent =
    mode === "light"
      ? hslToHex(accentH, Math.min(Math.max(hsl.s, 35), 65), 48)
      : hslToHex(accentH, Math.min(Math.max(hsl.s, 40), 70), 58);

  if (mode === "light") {
    const background = hslToHex(hsl.h, Math.min(hsl.s * 0.15, 12), 98);
    const foreground = hslToHex(hsl.h, Math.min(hsl.s * 0.25, 18), 12);
    const muted = hslToHex(hsl.h, Math.min(hsl.s * 0.2, 14), 94);
    return {
      background,
      foreground,
      primary: primaryAdj,
      muted,
      accent,
      onPrimary: contrastingInk(primaryAdj),
      onAccent: contrastingInk(accent),
    };
  }

  // Dark surface: deep tinted base (classic forest default lineage).
  const background = hslToHex(hsl.h, Math.min(Math.max(hsl.s * 0.35, 8), 22), 6);
  const foreground = hslToHex(hsl.h, Math.min(hsl.s * 0.2, 14), 92);
  const muted = hslToHex(hsl.h, Math.min(Math.max(hsl.s * 0.3, 10), 20), 10);

  return {
    background,
    foreground,
    primary: primaryAdj,
    muted,
    accent,
    onPrimary: contrastingInk(primaryAdj),
    onAccent: contrastingInk(accent),
  };
}

/** Convenience: merge generated colors into classic theme token shape. */
export function themeColorsForTokens(
  primary: string,
  mode: ThemeSurfaceMode,
): {
  background: string;
  foreground: string;
  primary: string;
  muted: string;
  accent: string;
} {
  const g = generateThemeFromPrimary(primary, mode);
  return {
    background: g.background,
    foreground: g.foreground,
    primary: g.primary,
    muted: g.muted,
    accent: g.accent,
  };
}
