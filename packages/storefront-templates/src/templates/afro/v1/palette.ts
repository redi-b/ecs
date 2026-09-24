import { clampChroma, converter, formatHex } from "culori";
import { contrastingInk, type GeneratedThemeColors, normalizeHex } from "../../../theme/palette";

const toOklch = converter("oklch");

/** Designed primary #ff720a — fallback when the merchant primary has no hue. */
const BASELINE_HUE = 47.02;

/** Primaries below this chroma are treated as black/white/grey (untinted). */
const NEUTRAL_MAX_CHROMA = 0.03;

/** Baseline OKLCH recipe for Afro v1 */
const ROLES = [
  { key: "background", L: 0.99, C: 0.006, dH: 12.6 },
  { key: "foreground", L: 0.194, C: 0.019, dH: 0.7 },
  { key: "muted", L: 0.964, C: 0.009, dH: 15.6 },
  { key: "accent", L: 0.865, C: 0.088, dH: 11.4 },
] as const;

const normHue = (h: number) => ((h % 360) + 360) % 360;

/**
 * Derive the full Afro solid-base palette from a single brand primary.
 * Every role keeps its designed L/C; only hue moves (primary ΔH).
 */
export function deriveAfroPalette(primaryInput: string): GeneratedThemeColors {
  const primary = normalizeHex(primaryInput, "#ff720a");
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
