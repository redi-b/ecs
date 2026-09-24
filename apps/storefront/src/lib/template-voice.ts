import type { StorefrontLocale } from "@ecs/contracts";

export const templateVoiceMessageIds = [
  "action_add_to_cart",
  "action_continue_shopping",
] as const;

export type TemplateVoiceMessageId = (typeof templateVoiceMessageIds)[number];

type TemplateVoiceOverrides = Partial<
  Record<TemplateVoiceMessageId, Partial<Record<StorefrontLocale, string>>>
>;

const overrides: Record<"luvia" | "nexahub" | "afro", TemplateVoiceOverrides> = {
  luvia: {
    action_add_to_cart: {
      en: "Add to bag",
    },
    action_continue_shopping: {
      en: "Keep browsing",
    },
  },
  nexahub: {},
  afro: {},
};

export function resolveTemplateVoiceMessage(input: {
  fallback: string;
  locale: StorefrontLocale;
  messageId: TemplateVoiceMessageId;
  templateKey: string;
}) {
  const template = templateFamily(input.templateKey);
  return overrides[template]?.[input.messageId]?.[input.locale] ?? input.fallback;
}

function templateFamily(templateKey: string): keyof typeof overrides {
  if (templateKey.startsWith("luvia")) return "luvia";
  if (templateKey.startsWith("afro")) return "afro";
  return "nexahub";
}
