import { Avatar, Style } from "@dicebear/core";
import definition from "@dicebear/styles/initial-face.json";
import {
  defaultProfileAvatar,
  type ProfileAvatarPreferences,
  parseProfileAvatar,
} from "@ecs/contracts";

export const profileAvatarColors = {
  blue: "#77a7f8",
  sky: "#75c7e8",
  mint: "#83d8bd",
  lavender: "#b5a0ea",
  sand: "#e5c56f",
  coral: "#e8957d",
  rose: "#d98ba6",
} as const;

export const profileAvatarEyes = [
  "variant01",
  "variant02",
  "variant03",
  "variant04",
  "variant05",
  "variant06",
  "variant07",
  "variant08",
] as const;

const profileAvatarAngles = { left: -12, straight: 0, right: 12 } as const;

export function profileInitial(name: string | null | undefined) {
  return (
    Array.from(name?.trim().match(/[\p{L}\p{N}]/u)?.[0] ?? "?")[0] ?? "?"
  ).toLocaleUpperCase();
}

/** Only replace the style's monogram variable. DiceBear still escapes the text. */
function withInitial(value: unknown, initial: string): unknown {
  if (Array.isArray(value)) return value.map((entry) => withInitial(entry, initial));
  if (!value || typeof value !== "object") return value;
  const object = value as Record<string, unknown>;
  if (object.type === "variable" && object.name === "initial") return initial;
  return Object.fromEntries(
    Object.entries(object).map(([key, entry]) => [key, withInitial(entry, initial)]),
  );
}

// Small bounded cache: names never accumulate for the lifetime of the app.
const styles = new Map<string, Style>();

export function profileAvatarDataUri(
  userId: string,
  name: string | null | undefined,
  preferences?: ProfileAvatarPreferences | null,
) {
  const initial = profileInitial(name);
  let style = styles.get(initial);
  if (!style) {
    style = new Style(withInitial(definition, initial));
    if (styles.size >= 64) styles.clear();
    styles.set(initial, style);
  }
  const config = parseProfileAvatar(preferences) ?? defaultProfileAvatar;
  return new Avatar(style, {
    seed: `ecs-profile-v1:${userId}:${config.variation}`,
    backgroundColor: profileAvatarColors[config.color],
    fontFamily: "Arial, Noto Sans Ethiopic, sans-serif",
    size: 96,
    idRandomization: false,
    ...(config.eyes === "auto" ? {} : { eyesVariant: config.eyes }),
    rotate: profileAvatarAngles[config.angle],
  }).toDataUri();
}
