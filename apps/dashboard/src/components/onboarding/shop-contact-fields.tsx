"use client";

import {
  ethiopianPhoneSchema,
  normalizeEthiopianPhone,
  normalizeShopSocialProfileUrl,
  type ShopDetails,
  shopDetailsSchema,
  shopSocialPlatforms,
} from "@ecs/contracts";
import { useId, useState } from "react";
import { z } from "zod";
import { AppIcons } from "@/components/app/icons";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/i18n/provider";
import { CategoryCombobox } from "./onboarding-form-parts";

export const socialLabels = {
  facebook: "Facebook",
  instagram: "Instagram",
  tiktok: "TikTok",
  telegram: "Telegram",
  whatsapp: "WhatsApp",
  youtube: "YouTube",
  linkedin: "LinkedIn",
  x: "X",
};
const socialExamples = {
  facebook: "yourshop or paste a link",
  instagram: "@yourshop or paste a link",
  tiktok: "@yourshop or paste a link",
  telegram: "yourshop or paste a link",
  whatsapp: "0912345678 or paste a link",
  youtube: "@yourshop or paste a link",
  linkedin: "yourshop or paste a link",
  x: "@yourshop or paste a link",
};
const socialIcons = {
  facebook: AppIcons.facebook,
  instagram: AppIcons.instagram,
  tiktok: AppIcons.tiktok,
  telegram: AppIcons.telegramBrand,
  whatsapp: AppIcons.whatsapp,
  youtube: AppIcons.youtube,
  linkedin: AppIcons.linkedin,
  x: AppIcons.x,
};

export function SocialPlatformIcon({
  platform,
  className,
}: {
  platform: keyof typeof socialIcons;
  className?: string;
}) {
  const Icon = socialIcons[platform];
  return <Icon aria-hidden className={className} />;
}

// A saved draft may be incomplete: validate its shape, not its readiness to submit.
export const shopContactDraftSchema = z.object({
  version: z.literal(1),
  categories: z.array(z.string().max(80)).max(5),
  description: z.string().max(300),
  primaryPhone: z.string().max(40),
  additionalPhones: z.array(z.string().max(40)).max(3),
  publicEmail: z.string().max(254),
  address: z
    .object({
      city: z.string().max(100),
      streetAddress: z.string().max(500),
      directions: z.string().max(300),
    })
    .optional(),
  socialProfiles: z
    .array(z.object({ platform: z.enum(shopSocialPlatforms), url: z.string().max(500) }))
    .max(8),
  brand: z
    .object({
      presetId: z.enum(["original", "blue", "rose", "amber", "violet", "teal"]),
      customPrimary: z.string().max(7).optional(),
    })
    .optional(),
});

export function emptyShopDetails(): ShopDetails {
  return {
    version: 1,
    categories: ["Other"],
    description: "",
    primaryPhone: "",
    additionalPhones: [],
    publicEmail: "",
    socialProfiles: [],
  };
}

/** Shared by onboarding and Settings → Shop; never tied to the login email. */
export function ShopContactFields({
  value,
  onChange,
  disabled = false,
  showShopFields = true,
}: {
  value: ShopDetails;
  onChange: (value: ShopDetails) => void;
  disabled?: boolean;
  showShopFields?: boolean;
}) {
  const id = useId();
  const { t } = useI18n();
  const [touched, setTouched] = useState<Set<string>>(() => new Set());
  const validation = shopDetailsSchema.safeParse(value);
  const issues = validation.success ? [] : validation.error.issues;
  const emailError =
    touched.has("email") && issues.some((issue) => issue.path[0] === "publicEmail")
      ? t("onboarding.contact.invalidEmail")
      : null;
  const socialError = (index: number) =>
    touched.has(`social-${index}`) &&
    issues.some((issue) => issue.path[0] === "socialProfiles" && issue.path[1] === index)
      ? t("onboarding.contact.invalidSocial")
      : null;
  const address = [value.address?.streetAddress, value.address?.city, value.address?.directions]
    .filter(Boolean)
    .join("\n");
  const phoneError = (phone: string, index: number) => {
    if (!touched.has(`phone-${index}`)) return null;
    if (!phone.trim()) return null;
    if (!ethiopianPhoneSchema.safeParse(phone).success) return t("onboarding.contact.invalidPhone");
    const normalized = normalizeEthiopianPhone(phone);
    const phones = [value.primaryPhone, ...value.additionalPhones].map(normalizeEthiopianPhone);
    return phones.indexOf(normalized) !== index ? t("onboarding.contact.duplicatePhone") : null;
  };
  function updatePhone(index: number, phone: string) {
    onChange(
      index === -1
        ? { ...value, primaryPhone: phone }
        : {
            ...value,
            additionalPhones: value.additionalPhones.map((current, i) =>
              i === index ? phone : current,
            ),
          },
    );
  }
  function markTouched(key: string) {
    setTouched((current) => {
      if (current.has(key)) return current;
      const next = new Set(current);
      next.add(key);
      return next;
    });
  }
  return (
    <FieldGroup>
      {showShopFields ? (
        <>
          <Field>
            <FieldLabel htmlFor={`${id}-categories`}>{t("onboarding.category")}</FieldLabel>
            <fieldset disabled={disabled}>
              <CategoryCombobox
                id={`${id}-categories`}
                values={value.categories}
                onChange={(categories) => {
                  if (categories.length <= 5) onChange({ ...value, categories });
                }}
                placeholder={t("onboarding.categoryPlaceholder")}
                searchPlaceholder={t("onboarding.categorySearch")}
              />
            </fieldset>
          </Field>
          <Field>
            <FieldLabel htmlFor={`${id}-description`}>
              {t("onboarding.contact.description")}
            </FieldLabel>
            <Textarea
              className="min-h-24 resize-y"
              disabled={disabled}
              id={`${id}-description`}
              maxLength={300}
              value={value.description}
              onChange={(event) => onChange({ ...value, description: event.target.value })}
            />
          </Field>
        </>
      ) : null}
      {[value.primaryPhone, ...value.additionalPhones].map((phone, position) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: Phone drafts have no stable IDs; their position identifies the edited field.
        <Field data-invalid={phoneError(phone, position) ? true : undefined} key={position}>
          <FieldLabel htmlFor={`${id}-phone-${position}`}>
            {position === 0
              ? t("onboarding.contact.phone")
              : t("onboarding.contact.additionalPhone", { number: position })}
          </FieldLabel>
          <div className="flex items-center gap-2">
            <InputGroup className="min-w-0 flex-1">
              <InputGroupAddon>+251</InputGroupAddon>
              <InputGroupInput
                aria-invalid={phoneError(phone, position) ? true : undefined}
                disabled={disabled}
                id={`${id}-phone-${position}`}
                type="tel"
                autoComplete="tel-national"
                placeholder="91 234 5678"
                value={phone.replace(/\D/g, "").replace(/^251/, "").replace(/^0/, "")}
                maxLength={12}
                onChange={(event) =>
                  updatePhone(
                    position - 1,
                    event.target.value
                      .replace(/\D/g, "")
                      .replace(/^251/, "")
                      .replace(/^0/, "")
                      .slice(0, 9),
                  )
                }
                onBlur={() => {
                  markTouched(`phone-${position}`);
                  updatePhone(position - 1, normalizeEthiopianPhone(phone));
                }}
              />
            </InputGroup>
            {position > 0 ? (
              <Button
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                disabled={disabled}
                type="button"
                variant="ghost"
                size="sm"
                aria-label={`${t("onboarding.contact.remove")} ${t("onboarding.contact.additionalPhone", { number: position })}`}
                onClick={() =>
                  onChange({
                    ...value,
                    additionalPhones: value.additionalPhones.filter((_, i) => i !== position - 1),
                  })
                }
              >
                <AppIcons.trash aria-hidden />
                {t("onboarding.contact.remove")}
              </Button>
            ) : null}
          </div>
          {phoneError(phone, position) ? (
            <FieldError>{phoneError(phone, position)}</FieldError>
          ) : null}
        </Field>
      ))}
      {value.additionalPhones.length < 3 ? (
        <div>
          <Button
            disabled={disabled}
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              onChange({ ...value, additionalPhones: [...value.additionalPhones, ""] })
            }
          >
            {t("onboarding.contact.addPhone")}
          </Button>
        </div>
      ) : null}
      <Field>
        <FieldLabel htmlFor={`${id}-email`}>{t("onboarding.contact.email")}</FieldLabel>
        <Input
          aria-invalid={emailError ? true : undefined}
          disabled={disabled}
          type="email"
          id={`${id}-email`}
          autoComplete="email"
          value={value.publicEmail}
          onBlur={() => markTouched("email")}
          onChange={(event) => onChange({ ...value, publicEmail: event.target.value })}
        />
        {emailError ? <FieldError>{emailError}</FieldError> : null}
      </Field>
      <Field>
        <FieldLabel htmlFor={`${id}-address`}>{t("onboarding.contact.address")}</FieldLabel>
        <Textarea
          className="min-h-24 resize-y"
          disabled={disabled}
          id={`${id}-address`}
          maxLength={500}
          value={address}
          onChange={(event) =>
            onChange({
              ...value,
              address: { city: "", directions: "", streetAddress: event.target.value },
            })
          }
        />
      </Field>
      <Field>
        <FieldLabel>{t("onboarding.contact.social")}</FieldLabel>
        {value.socialProfiles.map((profile, index) => (
          <div
            key={profile.platform}
            className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-2 sm:grid-cols-[9rem_minmax(0,1fr)_auto]"
          >
            <Select
              disabled={disabled}
              value={profile.platform}
              onValueChange={(platform) => {
                setTouched((current) => {
                  const next = new Set(current);
                  next.delete(`social-${index}`);
                  return next;
                });
                onChange({
                  ...value,
                  socialProfiles: value.socialProfiles.map((current, i) =>
                    i === index
                      ? { platform: platform as typeof profile.platform, url: "" }
                      : current,
                  ),
                });
              }}
            >
              <SelectTrigger
                className="w-full"
                aria-label={t("onboarding.contact.platform", { number: index + 1 })}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="start">
                {shopSocialPlatforms
                  .filter(
                    (platform) =>
                      platform === profile.platform ||
                      !value.socialProfiles.some((current) => current.platform === platform),
                  )
                  .map((platform) => {
                    return (
                      <SelectItem key={platform} value={platform}>
                        <SocialPlatformIcon
                          className="size-4 text-muted-foreground"
                          platform={platform}
                        />
                        {socialLabels[platform]}
                      </SelectItem>
                    );
                  })}
              </SelectContent>
            </Select>
            <Input
              aria-invalid={socialError(index) ? true : undefined}
              disabled={disabled}
              className="col-span-2 row-start-2 min-w-0 sm:col-span-1 sm:row-start-auto"
              type="text"
              autoCapitalize="none"
              autoCorrect="off"
              aria-label={t("onboarding.contact.profileLink", {
                platform: socialLabels[profile.platform],
              })}
              placeholder={socialExamples[profile.platform]}
              maxLength={500}
              value={profile.url}
              onBlur={() => {
                markTouched(`social-${index}`);
                const normalized = normalizeShopSocialProfileUrl(profile.platform, profile.url);
                if (normalized !== profile.url) {
                  onChange({
                    ...value,
                    socialProfiles: value.socialProfiles.map((current, i) =>
                      i === index ? { ...current, url: normalized } : current,
                    ),
                  });
                }
              }}
              onChange={(event) =>
                onChange({
                  ...value,
                  socialProfiles: value.socialProfiles.map((current, i) =>
                    i === index ? { ...current, url: event.target.value } : current,
                  ),
                })
              }
            />
            <Button
              disabled={disabled}
              className="col-start-2 row-start-1 text-destructive hover:bg-destructive/10 hover:text-destructive sm:col-start-3"
              type="button"
              variant="ghost"
              size="sm"
              aria-label={`${t("onboarding.contact.remove")} ${socialLabels[profile.platform]}`}
              onClick={() =>
                onChange({
                  ...value,
                  socialProfiles: value.socialProfiles.filter((_, i) => i !== index),
                })
              }
            >
              <AppIcons.trash aria-hidden />
              {t("onboarding.contact.remove")}
            </Button>
            {socialError(index) ? (
              <FieldError className="col-span-2 sm:col-start-2 sm:col-span-1">
                {socialError(index)}
              </FieldError>
            ) : null}
          </div>
        ))}
        {value.socialProfiles.length < shopSocialPlatforms.length ? (
          <div>
            <Button
              disabled={disabled}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                const platform = shopSocialPlatforms.find(
                  (candidate) =>
                    !value.socialProfiles.some((profile) => profile.platform === candidate),
                );
                if (platform)
                  onChange({
                    ...value,
                    socialProfiles: [...value.socialProfiles, { platform, url: "" }],
                  });
              }}
            >
              {t("onboarding.contact.addSocial")}
            </Button>
          </div>
        ) : null}
      </Field>
    </FieldGroup>
  );
}
