import {
  type NexahubV1Data,
  type NexahubV1ThemeTokens,
  nexahubV1DataSchema,
  nexahubV1Defaults,
  nexahubV1ThemeTokens,
  nexahubV1ThemeTokensSchema,
} from "@ecs/storefront-templates";
import { normalizeStorefrontMediaUrl } from "../../../lib/media-url";

export function parseNexahubData(data: unknown): NexahubV1Data {
  const parsed = nexahubV1DataSchema.safeParse(data);
  if (!parsed.success) return structuredClone(nexahubV1Defaults);

  const value = parsed.data;
  const migrate = (current: string, legacy: string, reference: string) => current === legacy ? reference : current;
  value.home.hero.eyebrow = migrate(value.home.hero.eyebrow, "Technology for everyday life", nexahubV1Defaults.home.hero.eyebrow);
  value.home.hero.title = migrate(value.home.hero.title, "Upgrade your everyday tech", nexahubV1Defaults.home.hero.title);
  value.home.hero.body = migrate(value.home.hero.body, "Discover thoughtfully selected devices and accessories for work, play, and everything between.", nexahubV1Defaults.home.hero.body);
  value.home.hero.primaryCtaLabel = migrate(value.home.hero.primaryCtaLabel, "Explore products", nexahubV1Defaults.home.hero.primaryCtaLabel);
  value.home.hero.primaryCtaHref = migrate(value.home.hero.primaryCtaHref, "/products", nexahubV1Defaults.home.hero.primaryCtaHref);
  value.home.featuredItem.eyebrow = migrate(value.home.featuredItem.eyebrow, "Featured item", nexahubV1Defaults.home.featuredItem.eyebrow);
  value.home.featuredItem.title = migrate(value.home.featuredItem.title, "Technology that keeps up with you", nexahubV1Defaults.home.featuredItem.title);
  value.home.categories.eyebrow = migrate(value.home.categories.eyebrow, "Shop by category", nexahubV1Defaults.home.categories.eyebrow);
  value.home.categories.title = migrate(value.home.categories.title, "Find the right technology for your day", nexahubV1Defaults.home.categories.title);
  value.home.bestSellers.title = migrate(value.home.bestSellers.title, "Selected products", nexahubV1Defaults.home.bestSellers.title);
  value.home.quality.eyebrow = migrate(value.home.quality.eyebrow, "Built for real life", nexahubV1Defaults.home.quality.eyebrow);
  value.home.quality.title = migrate(value.home.quality.title, "Quality technology, selected with care", nexahubV1Defaults.home.quality.title);
  value.home.quality.title = migrate(value.home.quality.title, "NEXAHUB IS ETHIOPIA'S LEADING TECH DISTRIBUTOR SINCE 2020, SPECIALIZING IN HIGH-END DEVICES.", nexahubV1Defaults.home.quality.title);
  value.home.quality.body = migrate(value.home.quality.body, "Practical products, clear information, and support when you need it.", nexahubV1Defaults.home.quality.body);
  value.home.contact.eyebrow = migrate(value.home.contact.eyebrow, "Need help choosing?", nexahubV1Defaults.home.contact.eyebrow);
  value.home.contact.title = migrate(value.home.contact.title, "Talk to our team", nexahubV1Defaults.home.contact.title);
  value.home.contact.ctaLabel = migrate(value.home.contact.ctaLabel, "Contact us", nexahubV1Defaults.home.contact.ctaLabel);
  value.footer.blurb = migrate(value.footer.blurb, "Technology selected for work, creativity, and everyday life.", nexahubV1Defaults.footer.blurb);
  value.footer.blurb = migrate(value.footer.blurb, "Since 2020, Ethiopia's leading distributor has been providing cutting-edge technology products. We offer a wide range of high-end devices, all backed by comprehensive warranties to ensure your satisfaction.", nexahubV1Defaults.footer.blurb);
  if (value.footer.address === "Addis Ababa, Ethiopia") value.footer.address = nexahubV1Defaults.footer.address;
  return value;
}

export function parseNexahubThemeTokens(tokens: unknown): NexahubV1ThemeTokens {
  const parsed = nexahubV1ThemeTokensSchema.safeParse(tokens);
  return parsed.success ? parsed.data : nexahubV1ThemeTokens;
}

export function nexahubAsset(value: string | undefined, fallback: string) {
  return normalizeStorefrontMediaUrl(value) ?? fallback;
}
