import { clampChroma, converter, formatHex } from "culori";
import { contrastingInk, type GeneratedThemeColors, normalizeHex } from "../../../theme/palette";

const toOklch = converter("oklch");

/** Designed primary #3ee272 — fallback when the merchant primary has no hue. */
const BASELINE_HUE = 149.34;

/** Primaries below this chroma are treated as black/white/grey (untinted). */
const NEUTRAL_MAX_CHROMA = 0.03;

/** Baseline OKLCH recipe: fixed L/C, hue offset relative to primary. */
const ROLES = [
  { key: "background", L: 0.992, C: 0.013, dH: -3.8 },
  { key: "foreground", L: 0.279, C: 0.067, dH: -4.2 },
  { key: "muted", L: 0.968, C: 0.018, dH: -1.2 },
  { key: "accent", L: 0.93, C: 0.142, dH: -9.9 },
] as const;

const normHue = (h: number) => ((h % 360) + 360) % 360;

/**
 * Derive the full Luvia solid-base palette from a single brand primary.
 * Every role keeps its designed L/C; only hue moves (primary ΔH). Out-of-gamut
 * chroma is reduced toward sRGB while L/H stay put. Near-neutral primaries
 * (black/white/grey) drop role chroma to 0 so dark stays dark and light goes
 * grey with no hue borrow.
 * ponytail: accent chroma collapses for blue/violet primaries (honest sRGB
 * limit at L=0.93) — do not per-hue-tune L, that breaks baseline round-trip.
 */
export function deriveLuviaPalette(primaryInput: string): GeneratedThemeColors {
  const primary = normalizeHex(primaryInput, "#3ee272");
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
