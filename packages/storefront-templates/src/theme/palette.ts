/**
 * Merchant theme generation from a designed seed palette.
 *
 * Flow: seed (designed once) + new brand primary
 *   → HSL offset shift relative to seed primary
 *   → contrast cleanup for text/fills
 *
 * Templates can pass their own seed later; defaults use classic light/dark seeds.
 * Storefront applies colors as CSS variables (--at-bg, --at-primary, …).
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

/** Designed palette for one surface mode. Templates supply their own later. */
export type ThemePaletteSeed = {
  id: string;
  surfaceMode: ThemeSurfaceMode;
  colors: {
    primary: string;
    background: string;
    foreground: string;
    muted: string;
    accent: string;
  };
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

// ---------------------------------------------------------------------------
// Designed seeds (swap / extend when real template designs land)
// ---------------------------------------------------------------------------

/** Classic dark: cold forest base, sage brand, clay accent. */
export const CLASSIC_DARK_SEED: ThemePaletteSeed = {
  id: "classic-dark",
  surfaceMode: "dark",
  colors: {
    primary: "#9bc4a0",
    background: "#0b0f0d",
    foreground: "#e6ebe4",
    muted: "#141a16",
    accent: "#d4785a",
  },
};

/** Classic light: soft paper base, deep teal brand, warm clay accent. */
export const CLASSIC_LIGHT_SEED: ThemePaletteSeed = {
  id: "classic-light",
  surfaceMode: "light",
  colors: {
    primary: "#0f766e",
    background: "#f7f8f6",
    foreground: "#121816",
    muted: "#e8ebe7",
    accent: "#c45c3e",
  },
};

export const DEFAULT_THEME_SEEDS: Record<ThemeSurfaceMode, ThemePaletteSeed> = {
  dark: CLASSIC_DARK_SEED,
  light: CLASSIC_LIGHT_SEED,
};

export function getDefaultThemeSeed(mode: ThemeSurfaceMode): ThemePaletteSeed {
  return DEFAULT_THEME_SEEDS[mode];
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function normHue(h: number) {
  return ((h % 360) + 360) % 360;
}

/**
 * Shift one seed color so its relationship to seed primary is preserved
 * relative to the new primary (hue offset + sat/light deltas).
 */
export function shiftColorRelativeToPrimary(
  seedColor: string,
  seedPrimary: string,
  newPrimary: string,
): string {
  const sc = hexToHsl(seedColor);
  const sp = hexToHsl(seedPrimary);
  const np = hexToHsl(newPrimary);
  if (!sc || !sp || !np) return normalizeHex(seedColor);

  // Near-neutrals: keep lightness, gently pull hue toward brand, low sat.
  if (sc.s < 12) {
    const pulledS = clamp(sc.s + np.s * 0.08, 0, 18);
    return hslToHex(np.h, pulledS, clamp(sc.l + (np.l - sp.l) * 0.15, 2, 98));
  }

  const dh = sc.h - sp.h;
  const ds = sc.s - sp.s;
  const dl = sc.l - sp.l;

  return hslToHex(
    normHue(np.h + dh),
    clamp(np.s + ds, 0, 100),
    clamp(np.l + dl, 2, 98),
  );
}

/** Keep brand primary usable on both surfaces. */
export function clampPrimaryForSurface(primaryHex: string, mode: ThemeSurfaceMode): string {
  const primary = normalizeHex(primaryHex, CLASSIC_DARK_SEED.colors.primary);
  const hsl = hexToHsl(primary);
  if (!hsl) return primary;

  let { h, s, l } = hsl;
  s = clamp(s, 18, 78);
  if (mode === "light") {
    l = clamp(l, 28, 58);
  } else {
    l = clamp(l, 42, 72);
  }
  return hslToHex(h, s, l);
}

/**
 * After offset shift: ensure text/surface contrast and ink on fills.
 */
export function ensurePaletteContrast(colors: Omit<GeneratedThemeColors, "onPrimary" | "onAccent">): GeneratedThemeColors {
  let { background, foreground, primary, muted, accent } = colors;
  background = normalizeHex(background);
  foreground = normalizeHex(foreground);
  primary = normalizeHex(primary);
  muted = normalizeHex(muted);
  accent = normalizeHex(accent);

  // Body text vs page background
  if (contrastRatio(background, foreground) < 4.5) {
    foreground = contrastingInk(background);
  }

  // Muted should stay on the same side of the surface as background
  const bgL = relativeLuminance(background);
  const mutedL = relativeLuminance(muted);
  if (bgL > 0.45 && mutedL > bgL) {
    // muted brighter than light bg: darken slightly
    const m = hexToHsl(muted);
    if (m) muted = hslToHex(m.h, m.s, clamp(m.l - 6, 80, 96));
  }
  if (bgL <= 0.45 && mutedL < bgL) {
    const m = hexToHsl(muted);
    if (m) muted = hslToHex(m.h, m.s, clamp(m.l + 4, 6, 22));
  }

  // Primary should not vanish into background
  if (contrastRatio(background, primary) < 1.6) {
    const p = hexToHsl(primary);
    if (p) {
      const toward = bgL > 0.45 ? -18 : 14;
      primary = hslToHex(p.h, p.s, clamp(p.l + toward, 20, 75));
    }
  }

  return {
    background,
    foreground,
    primary,
    muted,
    accent,
    onPrimary: contrastingInk(primary),
    onAccent: contrastingInk(accent),
  };
}

/**
 * Recolor a designed seed palette onto a new brand primary.
 * Preserves relative HSL offsets from the seed primary, then cleans contrast.
 */
export function generateThemeFromSeed(
  primaryInput: string,
  seed: ThemePaletteSeed,
): GeneratedThemeColors {
  const mode = seed.surfaceMode;
  const seedPrimary = normalizeHex(seed.colors.primary, CLASSIC_DARK_SEED.colors.primary);
  const primary = clampPrimaryForSurface(primaryInput, mode);

  const shifted = {
    primary,
    background: shiftColorRelativeToPrimary(seed.colors.background, seedPrimary, primary),
    foreground: shiftColorRelativeToPrimary(seed.colors.foreground, seedPrimary, primary),
    muted: shiftColorRelativeToPrimary(seed.colors.muted, seedPrimary, primary),
    accent: shiftColorRelativeToPrimary(seed.colors.accent, seedPrimary, primary),
  };

  return ensurePaletteContrast(shifted);
}

/**
 * Build a full theme color set from a brand primary + surface mode.
 * Optional `seed` lets templates inject their designed default palette later.
 */
export function generateThemeFromPrimary(
  primaryInput: string,
  mode: ThemeSurfaceMode = "dark",
  seed?: ThemePaletteSeed,
): GeneratedThemeColors {
  const resolved = seed ?? getDefaultThemeSeed(mode);
  // If caller passes a seed for the other surface, still honor `mode` via default seeds.
  const useSeed = resolved.surfaceMode === mode ? resolved : getDefaultThemeSeed(mode);
  return generateThemeFromSeed(primaryInput, useSeed);
}

/** Convenience: merge generated colors into classic theme token shape. */
export function themeColorsForTokens(
  primary: string,
  mode: ThemeSurfaceMode,
  seed?: ThemePaletteSeed,
): {
  background: string;
  foreground: string;
  primary: string;
  muted: string;
  accent: string;
} {
  const g = generateThemeFromPrimary(primary, mode, seed);
  return {
    background: g.background,
    foreground: g.foreground,
    primary: g.primary,
    muted: g.muted,
    accent: g.accent,
  };
}
