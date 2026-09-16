import { generateThemeFromSeed, type ThemePaletteSeed } from "./palette";

export type BrandPresetId = "original" | "blue" | "rose" | "amber" | "violet" | "teal";
export type BrandPreset = { id: BrandPresetId; colors: ThemePaletteSeed["colors"] };

// Full, designed palettes. Presets do not depend on a calculated hue shift.
const luvia: readonly BrandPreset[] = [
  { id: "original", colors: { background: "#f7fff7", foreground: "#0f3112", primary: "#3ee272", muted: "#edf8ee", accent: "#b5ffa2" } },
  { id: "blue", colors: { background: "#f6faff", foreground: "#152d49", primary: "#80b7f4", muted: "#eaf2fc", accent: "#c7defa" } },
  { id: "rose", colors: { background: "#fff8fa", foreground: "#472334", primary: "#efa0bc", muted: "#f9eaf0", accent: "#fad1df" } },
  { id: "amber", colors: { background: "#fffbf3", foreground: "#45341a", primary: "#e8b75c", muted: "#f7eedb", accent: "#f6dda9" } },
  { id: "violet", colors: { background: "#fbf8ff", foreground: "#342448", primary: "#baa0ee", muted: "#f0eafa", accent: "#decef8" } },
  { id: "teal", colors: { background: "#f5fcfa", foreground: "#163c34", primary: "#76cbb6", muted: "#e5f3ee", accent: "#bde8dc" } },
];
const nexahub: readonly BrandPreset[] = [
  { id: "original", colors: { background: "#f8f8fc", foreground: "#262732", primary: "#3064d5", muted: "#f0f0f6", accent: "#b4cffd" } },
  { id: "blue", colors: { background: "#f7f9fc", foreground: "#17283d", primary: "#8cbaff", muted: "#e9eef6", accent: "#c0d8fa" } },
  { id: "rose", colors: { background: "#fcf8f9", foreground: "#3b232d", primary: "#f5a1ba", muted: "#f2e8ec", accent: "#f7c6d4" } },
  { id: "amber", colors: { background: "#fcfaf5", foreground: "#3a2d19", primary: "#f1bc58", muted: "#f1ecdf", accent: "#f5d99c" } },
  { id: "violet", colors: { background: "#faf8fc", foreground: "#30243e", primary: "#bca1f2", muted: "#eee8f5", accent: "#d9c7fa" } },
  { id: "teal", colors: { background: "#f6faf9", foreground: "#18382f", primary: "#7bd4b3", muted: "#e6f0eb", accent: "#b6e7d2" } },
];

export function getBrandPresets(templateKey: string): readonly BrandPreset[] {
  return templateKey === "nexahub@1" ? nexahub : luvia;
}

export function getStartingBrandTokens(templateKey: string, tokens: unknown, brand?: { presetId: BrandPresetId; customPrimary?: string | undefined }): unknown {
  if (!brand || !tokens || typeof tokens !== "object" || Array.isArray(tokens)) return tokens;
  const preset = getBrandPresets(templateKey).find((item) => item.id === brand.presetId)!;
  const colors = brand.customPrimary
    ? generateThemeFromSeed(brand.customPrimary, { id: `${templateKey}-${preset.id}`, surfaceMode: "light", colors: preset.colors })
    : preset.colors;
  return { ...tokens, autoPalette: false, colors };
}
