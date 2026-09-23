import { clampChroma, converter, formatHex } from "culori";
import { contrastingInk, type GeneratedThemeColors, normalizeHex } from "../../../theme/palette";

const toOklch = converter("oklch");

/** Designed primary #3064d5 — fallback when the merchant primary has no hue. */
const BASELINE_HUE = 263.14;

/** Primaries below this chroma are treated as black/white/grey (untinted). */
const NEUTRAL_MAX_CHROMA = 0.03;

/** Baseline OKLCH recipe for Nexahub v1 */
const ROLES = [
  { key: "background", L: 0.98, C: 0.005, dH: 23.2 },
  { key: "foreground", L: 0.277, C: 0.02, dH: 17.8 },
  { key: "muted", L: 0.957, C: 0.008, dH: 23.1 },
  { key: "accent", L: 0.85, C: 0.071, dH: -2.1 },
] as const;

const normHue = (h: number) => ((h % 360) + 360) % 360;

/**
 * Derive the full Nexahub solid-base palette from a single brand primary.
 * Every role keeps its designed L/C; only hue moves (primary ΔH).
 */
export function deriveNexahubPalette(primaryInput: string): GeneratedThemeColors {
  const primary = normalizeHex(primaryInput, "#3064d5");
  const parsed = toOklch(primary);
  const chroma = parsed && typeof parsed.c === "number" ? parsed.c : 0;
  const neutral = chroma < NEUTRAL_MAX_CHROMA;
  const hue0 = parsed && typeof parsed.h === "number" ? parsed.h : BASELINE_HUE;

  const colors = { primary } as Pick<
    GeneratedThemeColors,
    "background" | "foreground" | "primary" | "muted" | "accent"
  >;
  for (const role of ROLES) {
    const hex =
      formatHex(
        clampChroma(
          {
            mode: "oklch",
            l: role.L,
            c: neutral ? 0 : role.C,
            h: normHue(hue0 + role.dH),
          },
          "oklch",
        ),
      ) ?? primary;
    colors[role.key] = hex;
  }

  return {
    ...colors,
    onPrimary: contrastingInk(colors.primary),
    onAccent: contrastingInk(colors.accent),
  };
}
