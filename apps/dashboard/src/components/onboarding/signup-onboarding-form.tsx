"use client";
import { type StorefrontTemplateCatalogItem, shopDetailsSchema } from "@ecs/contracts";
import { getBrandPresets } from "@ecs/storefront-templates";
import { useEffect, useId, useMemo, useState } from "react";
import { z } from "zod";
import { AppIcons } from "@/components/app/icons";
import {
  CategoryCombobox,
  HandleStatus,
  PreferenceToggle,
  ReviewItem,
  TemplateOption,
} from "@/components/onboarding/onboarding-form-parts";
import {
  getHandleReason,
  getRecommendedTemplateKey,
  type HandleState,
  mapOnboardingError,
  ONBOARDING_DRAFT_KEY,
  parseCategories,
  sanitizeHandleDraft,
  serializeCategories,
  slugify,
} from "@/components/onboarding/onboarding-helpers";
import { ShopBrandPicker } from "@/components/onboarding/shop-brand-picker";
import {
  emptyShopDetails,
  ShopContactFields,
  shopContactDraftSchema,
} from "@/components/onboarding/shop-contact-fields";
import { StorefrontTemplatePreview } from "@/components/storefront/storefront-template-preview";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/i18n/provider";
import { getStorefrontHostname, normalizeStorefrontBaseDomain } from "@/lib/storefront-hosts";
import { cn } from "@/lib/utils";

export function ShopOnboardingForm({
  defaultValues,
  errorMessage,
  storefrontBaseDomain,
  templates,
}: {
  defaultValues: {
    businessCategory?: string | undefined;
    contactPhone?: string | undefined;
    handle?: string | undefined;
    shopName?: string | undefined;
  };
  errorMessage: string | null;
  storefrontBaseDomain: string;
  templates: StorefrontTemplateCatalogItem[];
}) {
  const fieldId = useId();
  const formId = `${fieldId}-form`;
  const { t } = useI18n();
  const steps = useMemo(
    () =>
      [
        {
          id: "shop",
          title: t("onboarding.shopStep"),
          description: t("onboarding.shopStepDescription"),
          detail: t("onboarding.shopStepDetail"),
        },
        {
          id: "contact",
          title: t("onboarding.contactStep"),
          description: t("onboarding.contactStepDescription"),
          detail: t("onboarding.contactStepDetail"),
        },
        {
          id: "storefront",
          title: t("onboarding.storefrontStep"),
          description: t("onboarding.storefrontStepDescription"),
          detail: t("onboarding.storefrontStepDetail"),
        },
        {
          id: "review",
          title: t("onboarding.reviewStep"),
          description: t("onboarding.reviewStepDescription"),
          detail: t("onboarding.reviewStepDetail"),
        },
      ] as const,
    [t],
  );

  const lastStep = steps.length - 1;
  const [step, setStep] = useState(0);
  const [draftHydrated, setDraftHydrated] = useState(false);
  const [shopName, setShopName] = useState(defaultValues.shopName ?? "");
  const [handle, setHandle] = useState(defaultValues.handle ?? "");
  const [handleTouched, setHandleTouched] = useState(Boolean(defaultValues.handle));
  const [templateKey, setTemplateKey] = useState(templates[0]?.version.templateKey ?? "");
  const [templateTouched, setTemplateTouched] = useState(false);
  const [businessCategories, setBusinessCategories] = useState<string[]>(() =>
    parseCategories(defaultValues.businessCategory),
  );
  const [shopDetails, setShopDetails] = useState(() => ({
    ...emptyShopDetails(),
    primaryPhone: defaultValues.contactPhone ?? "",
  }));
  const [deliveryEnabled, setDeliveryEnabled] = useState(true);
  const [pickupEnabled, setPickupEnabled] = useState(true);
  const [handleState, setHandleState] = useState<HandleState>({
    status: "idle",
    message: t("onboarding.handle.choose"),
  });
  const [submitError, setSubmitError] = useState<string | null>(errorMessage);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const businessCategory = serializeCategories(businessCategories);
  const normalizedBaseDomain = normalizeStorefrontBaseDomain(storefrontBaseDomain);

  const selectedTemplate = useMemo(
    () =>
      templates.find((template) => template.version.templateKey === templateKey) ?? templates[0],
    [templateKey, templates],
  );
  const selectedBrand = getBrandPresets(templateKey).find(
    (preset) => preset.id === (shopDetails.brand?.presetId ?? "original"),
  );

  const previewHostname =
    handleState.status === "available"
      ? handleState.hostname
      : getStorefrontHostname(handle || "your-shop", storefrontBaseDomain);

  useEffect(() => {
    if (handleTouched) return;
    setHandle(slugify(shopName));
  }, [handleTouched, shopName]);

  useEffect(() => {
    setDraftHydrated(true);
    if (defaultValues.shopName || defaultValues.handle) return;
    try {
      const draft = window.localStorage.getItem(ONBOARDING_DRAFT_KEY);
      if (!draft) return;
      const value = z
        .object({
          shopName: z.string().max(120).optional(),
          handle: z.string().max(63).optional(),
          businessCategory: z.string().max(500).optional(),
          contactPhone: z.string().max(40).optional(),
          shopDetails: z.unknown().optional(),
          deliveryEnabled: z.boolean().optional(),
          pickupEnabled: z.boolean().optional(),
          templateKey: z.string().max(100).optional(),
          step: z.number().int().min(0).max(3).optional(),
        })
        .parse(JSON.parse(draft));
      setShopName(value.shopName ?? "");
      setHandle(value.handle ?? "");
      setHandleTouched(Boolean(value.handle));
      setBusinessCategories(parseCategories(value.businessCategory));
      const details = shopContactDraftSchema.safeParse(value.shopDetails);
      setShopDetails(
        details.success
          ? details.data
          : { ...emptyShopDetails(), primaryPhone: value.contactPhone ?? "" },
      );
      if (typeof value.deliveryEnabled === "boolean") setDeliveryEnabled(value.deliveryEnabled);
      if (typeof value.pickupEnabled === "boolean") setPickupEnabled(value.pickupEnabled);
      if (
        value.templateKey &&
        templates.some((item) => item.version.templateKey === value.templateKey)
      ) {
        setTemplateKey(value.templateKey);
        setTemplateTouched(true);
      }
      setStep(value.step ?? 0);
    } catch {
      // A blocked or old browser draft must not prevent setup.
    }
  }, [defaultValues.handle, defaultValues.shopName, templates]);

  useEffect(() => {
    if (!draftHydrated) return;
    try {
      window.localStorage.setItem(
        ONBOARDING_DRAFT_KEY,
        JSON.stringify({
          businessCategory: serializeCategories(businessCategories),
          shopDetails,
          deliveryEnabled,
          pickupEnabled,
          handle,
          shopName,
          templateKey,
          step,
        }),
      );
    } catch {
      /* Setup remains usable when local storage is unavailable. */
    }
  }, [
    businessCategories,
    handle,
    shopName,
    templateKey,
    shopDetails,
    deliveryEnabled,
    pickupEnabled,
    draftHydrated,
    step,
  ]);

  const recommendedTemplateKey = useMemo(
    () => getRecommendedTemplateKey(businessCategories, templates),
    [businessCategories, templates],
  );

  useEffect(() => {
    if (!templateTouched && recommendedTemplateKey) {
      setTemplateKey(recommendedTemplateKey);
    }
  }, [recommendedTemplateKey, templateTouched]);

  useEffect(() => {
    const normalized = slugify(handle);

    if (!normalized) {
      setHandleState({ status: "idle", message: t("onboarding.handle.choose") });
      return;
    }

    if (normalized !== handle || normalized.length < 3) {
      setHandleState({ status: "idle", message: t("onboarding.handle.choose") });
      return;
    }

    setHandleState({ status: "checking", message: t("onboarding.handle.checking") });

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      const response = await fetch(
        `/onboarding/handle?handle=${encodeURIComponent(normalized)}`,
        { signal: controller.signal },
      ).catch(() => null);

      if (!response) {
        setHandleState({
          status: "unavailable",
          message: t("onboarding.handle.checkFailed"),
        });
        return;
      }

      const data = (await response.json().catch(() => ({}))) as {
        available?: boolean;
        hostname?: string;
        reason?: string;
      };

      if (!response.ok || !data.available) {
        setHandleState({
          status: "unavailable",
          message: getHandleReason(data.reason, t),
        });
        return;
      }

      setHandleState({
        status: "available",
        hostname: data.hostname ?? getStorefrontHostname(normalized, storefrontBaseDomain),
        message: t("onboarding.handle.available"),
      });
    }, 350);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [handle, storefrontBaseDomain, t]);

  const canContinueShop =
    Boolean(shopName.trim()) && businessCategories.length > 0 && handleState.status === "available";
  const parsedDetails = shopDetailsSchema.safeParse({
    ...shopDetails,
    categories: businessCategories,
  });
  const canContinueContact = parsedDetails.success && (deliveryEnabled || pickupEnabled);
  const canContinueStorefront = Boolean(templateKey);
  const canContinue =
    (step === 0 && canContinueShop) ||
    (step === 1 && canContinueContact) ||
    (step === 2 && canContinueStorefront) ||
    step === 3;
  const canSubmit =
    canContinueShop &&
    canContinueContact &&
    canContinueStorefront &&
    handleState.status === "available";

  const current = steps[step] ?? steps[0];

  function goNext() {
    setStep((value) => Math.min(lastStep, value + 1));
  }

  function goBack() {
    setStep((value) => Math.max(0, value - 1));
  }

  async function submitOnboarding(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step < lastStep || !canSubmit || isSubmitting) return;

    setIsSubmitting(true);
    setSubmitError(null);

    const response = await fetch("/onboarding/submit", {
      body: JSON.stringify({
        businessCategory,
        contactPhone: shopDetails.primaryPhone.trim(),
        ...(parsedDetails.success ? { shopDetails: parsedDetails.data } : {}),
        deliveryEnabled,
        handle,
        phoneConfirmationRequired: true,
        pickupEnabled,
        shopName,
        templateKey,
      }),
      headers: {
        accept: "application/json",
        "content-type": "application/json",
      },
      method: "POST",
    }).catch(() => null);

    const data = (await response?.json().catch(() => null)) as {
      error?: string;
      ok?: boolean;
      redirectTo?: string;
      deliveryPrefsApplied?: boolean;
      warning?: string;
    } | null;

    if (!response?.ok || !data?.ok || !data.redirectTo) {
      setSubmitError(mapOnboardingError(data?.error, t));
      setIsSubmitting(false);
      return;
    }

    if (data.deliveryPrefsApplied === false || data.warning === "delivery_prefs_not_applied") {
      // Shop exists; surface that fulfillment prefs still need Settings → Fulfillment.
      try {
        window.sessionStorage.setItem("ecs:onboarding-warning", "delivery_prefs_not_applied");
      } catch {
        // ignore storage failures
      }
    }

    try {
      window.localStorage.removeItem(ONBOARDING_DRAFT_KEY);
    } catch {
      /* Shop creation already succeeded. */
    }
    window.location.assign(data.redirectTo);
  }

  return (
    <div className="grid gap-5 sm:gap-8 lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-12">
      <nav aria-label={t("onboarding.stepsLabel")} className="lg:sticky lg:top-8 lg:self-start">
        {/* Mobile: compact step rail */}
        <ol className="flex items-center gap-1 rounded-xl border border-border bg-card p-1.5 lg:hidden">
          {steps.map((item, index) => {
            const complete = index < step;
            const active = index === step;
            return (
              <li className="min-w-0 flex-1" key={item.id}>
                <button
                  aria-current={active ? "step" : undefined}
                  aria-label={`${item.title} (${index + 1} of ${steps.length})`}
                  className={cn(
                    "flex w-full flex-col items-center gap-1 rounded-lg px-1 py-2 text-center transition-colors",
                    "outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
                    active && "bg-muted",
                  )}
                  onClick={() => {
                    if (index <= step) setStep(index);
                  }}
                  type="button"
                >
                  <span
                    className={cn(
                      "grid size-7 place-items-center rounded-full text-xs font-semibold",
                      (complete || active) && "bg-primary text-primary-foreground",
                      !active && !complete && "bg-muted text-muted-foreground ring-1 ring-border",
                    )}
                  >
                    {complete ? <AppIcons.check className="size-3.5" /> : index + 1}
                  </span>
                  <span
                    className={cn(
                      "w-full truncate text-[0.7rem] font-medium leading-tight",
                      active ? "text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {item.title}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>

        {/* Desktop: vertical step list */}
        <ol className="hidden lg:flex lg:flex-col">
          {steps.map((item, index) => {
            const complete = index < step;
            const active = index === step;
            return (
              <li key={item.id}>
                <button
                  aria-current={active ? "step" : undefined}
                  className={cn(
                    "group flex w-full items-start gap-3 rounded-xl px-2.5 py-3 text-left transition-colors",
                    "outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
                    active && "bg-muted/70",
                    !active && "hover:bg-muted/40",
                  )}
                  onClick={() => {
                    if (index <= step) setStep(index);
                  }}
                  type="button"
                >
                  <span
                    className={cn(
                      "mt-0.5 grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold transition-colors",
                      (complete || active) && "bg-primary text-primary-foreground",
                      !active && !complete && "bg-muted text-muted-foreground ring-1 ring-border",
                    )}
                  >
                    {complete ? <AppIcons.check className="size-3.5" /> : index + 1}
                  </span>
                  <span className="min-w-0 pt-0.5">
                    <span
                      className={cn(
                        "block text-sm font-medium",
                        active ? "text-foreground" : "text-muted-foreground",
                      )}
                    >
                      {item.title}
                    </span>
                    <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
                      {item.description}
                    </span>
                  </span>
                </button>
                {index < steps.length - 1 ? (
                  <div aria-hidden className="ml-[1.35rem] h-3 w-px bg-border" />
                ) : null}
              </li>
            );
          })}
        </ol>
        <div className="mt-5 hidden space-y-1 px-2.5 lg:block">
          <p className="text-xs text-muted-foreground">{t("onboarding.estimatedTime")}</p>
          <p className="text-xs text-muted-foreground">{t("onboarding.draftSaved")}</p>
        </div>
      </nav>

      <div className="min-w-0">
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="border-b px-4 py-5 sm:px-8 sm:py-7">
            <div className="max-w-xl">
              <p className="text-xs font-medium text-muted-foreground">
                {t("onboarding.stepOf", {
                  current: String(step + 1),
                  total: String(steps.length),
                })}
              </p>
              <h2 className="mt-2 text-lg font-semibold tracking-tight sm:text-[1.35rem]">
                {current.title}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-pretty text-muted-foreground">
                {current.detail}
              </p>
            </div>
            <div className="mt-5 h-1 overflow-hidden rounded-full bg-muted sm:mt-6">
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-300 ease-[var(--ease-dashboard)]"
                style={{ width: `${((step + 1) / steps.length) * 100}%` }}
              />
            </div>
          </div>

          <div className="px-4 py-6 sm:px-8 sm:py-8">
            {submitError ? (
              <Alert className="mb-7" variant="destructive">
                <AppIcons.error />
                <AlertTitle>{t("onboarding.paused")}</AlertTitle>
                <AlertDescription>{submitError}</AlertDescription>
              </Alert>
            ) : null}

            <form
              className="flex flex-col gap-7"
              id={formId}
              onSubmit={(event) => void submitOnboarding(event)}
            >
              <div className={cn(step === 0 ? "grid gap-6" : "hidden")}>
                <Field>
                  <FieldLabel htmlFor={`${fieldId}-shopName`}>
                    {t("onboarding.shopName")}
                  </FieldLabel>
                  <Input
                    autoComplete="organization"
                    autoFocus={step === 0}
                    className="h-11 px-3.5"
                    id={`${fieldId}-shopName`}
                    name="shopName"
                    onChange={(event) => setShopName(event.target.value)}
                    placeholder={t("onboarding.shopNamePlaceholder")}
                    required
                    value={shopName}
                  />
                </Field>

                <Field data-invalid={handleState.status === "unavailable" ? true : undefined}>
                  <FieldLabel htmlFor={`${fieldId}-handle`}>
                    {t("onboarding.shopAddress")}
                  </FieldLabel>
                  <div className="overflow-hidden rounded-[1.75rem] border border-input bg-background transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/25">
                    <div className="flex h-12 items-center px-4">
                      <span className="shrink-0 text-sm text-muted-foreground">https://</span>
                      <Input
                        className="h-10 min-w-16 flex-1 rounded-none border-0 bg-transparent px-1 shadow-none focus-visible:ring-0"
                        id={`${fieldId}-handle`}
                        name="handle"
                        onBlur={() => setHandle(slugify(handle))}
                        onChange={(event) => {
                          setHandleTouched(true);
                          setHandle(sanitizeHandleDraft(event.target.value));
                        }}
                        pattern="[a-z0-9][a-z0-9-]{1,38}[a-z0-9]"
                        required
                        value={handle}
                      />
                      <span className="shrink-0 text-sm text-muted-foreground">
                        .{normalizedBaseDomain}
                      </span>
                    </div>
                    <div className="flex min-h-11 items-center justify-between gap-4 border-t bg-muted/20 px-4 py-2.5 text-xs sm:text-sm">
                      <span className="min-w-0 truncate font-medium tabular-nums text-foreground/90">
                        {previewHostname}
                      </span>
                      <HandleStatus message={handleState.message} status={handleState.status} />
                    </div>
                  </div>
                </Field>

                <div className="grid gap-6">
                  <Field>
                    <FieldLabel htmlFor={`${fieldId}-businessCategory`}>
                      {t("onboarding.category")}
                    </FieldLabel>
                    <input name="businessCategory" type="hidden" value={businessCategory} />
                    <CategoryCombobox
                      id={`${fieldId}-businessCategory`}
                      onChange={setBusinessCategories}
                      placeholder={t("onboarding.categoryPlaceholder")}
                      searchPlaceholder={t("onboarding.categorySearch")}
                      values={businessCategories}
                    />
                    <FieldDescription>{t("onboarding.categoryHelp")}</FieldDescription>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor={`${fieldId}-description`}>
                      {t("onboarding.contact.description")}
                    </FieldLabel>
                    <Textarea
                      className="min-h-24 resize-y"
                      id={`${fieldId}-description`}
                      maxLength={300}
                      value={shopDetails.description}
                      onChange={(event) =>
                        setShopDetails((current) => ({
                          ...current,
                          description: event.target.value,
                        }))
                      }
                    />
                  </Field>
                </div>
              </div>
              <div className={cn(step === 1 ? "grid gap-6" : "hidden")}>
                <ShopContactFields
                  showShopFields={false}
                  value={shopDetails}
                  disabled={isSubmitting}
                  onChange={setShopDetails}
                />
                <div className="rounded-xl border border-border/90 p-4 sm:p-5">
                  <p className="text-sm font-semibold tracking-tight">
                    {t("onboarding.checkoutPrefsTitle")}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t("onboarding.checkoutPrefsHelp")}
                  </p>
                  <div className="mt-4 grid gap-3">
                    <PreferenceToggle
                      checked={deliveryEnabled}
                      description={t("onboarding.offerDeliveryHelp")}
                      label={t("onboarding.offerDelivery")}
                      onCheckedChange={(checked) => {
                        // Keep at least one fulfillment method for checkout.
                        if (!checked && !pickupEnabled) return;
                        setDeliveryEnabled(checked);
                      }}
                    />
                    <PreferenceToggle
                      checked={pickupEnabled}
                      description={t("onboarding.offerPickupHelp")}
                      label={t("onboarding.offerPickup")}
                      onCheckedChange={(checked) => {
                        if (!checked && !deliveryEnabled) return;
                        setPickupEnabled(checked);
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className={cn(step === 2 ? "grid gap-5" : "hidden")}>
                <input name="templateKey" type="hidden" value={templateKey} />
                <div className="grid gap-4">
                  {templates.map((template) => (
                    <TemplateOption
                      checked={template.version.templateKey === templateKey}
                      key={template.version.templateKey}
                      onSelect={() => {
                        setTemplateTouched(true);
                        setTemplateKey(template.version.templateKey);
                      }}
                      recommended={template.version.templateKey === recommendedTemplateKey}
                      template={template}
                    />
                  ))}
                </div>
                {!templates.length ? (
                  <Alert variant="destructive">
                    <AppIcons.error />
                    <AlertTitle>{t("onboarding.noStorefronts")}</AlertTitle>
                    <AlertDescription>{t("onboarding.noStorefrontsDescription")}</AlertDescription>
                  </Alert>
                ) : null}
                {templateKey ? (
                  <ShopBrandPicker
                    templateKey={templateKey}
                    shopName={shopName}
                    value={shopDetails.brand}
                    disabled={isSubmitting}
                    onChange={(brand) => setShopDetails((current) => ({ ...current, brand }))}
                  />
                ) : null}
              </div>

              <div className={cn(step === 3 ? "grid gap-4" : "hidden")}>
                <div className="overflow-hidden rounded-xl border border-border/90 bg-background">
                  <section className="p-5 sm:p-6">
                    <div className="mb-5 flex items-center justify-between gap-3">
                      <h3 className="text-sm font-semibold tracking-tight">
                        {t("onboarding.shopStep")}
                      </h3>
                      <Button size="sm" variant="outline" type="button" onClick={() => setStep(0)}>
                        <AppIcons.edit aria-hidden />
                        {t("onboarding.contact.edit")}
                      </Button>
                    </div>
                    <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
                      <ReviewItem label={t("onboarding.shopName")} value={shopName} />
                      <ReviewItem label={t("onboarding.shopAddress")} value={previewHostname} />
                      <ReviewItem
                        label={t("onboarding.category")}
                        value={
                          businessCategories.length
                            ? businessCategories.join(", ")
                            : t("common.notSet")
                        }
                      />
                      {shopDetails.description ? (
                        <ReviewItem
                          className="sm:col-span-2"
                          label={t("onboarding.contact.description")}
                          value={shopDetails.description}
                        />
                      ) : null}
                    </dl>
                  </section>
                  <section className="border-t p-5 sm:p-6">
                    <div className="mb-5 flex items-center justify-between gap-3">
                      <h3 className="text-sm font-semibold">{t("onboarding.contactStep")}</h3>
                      <Button size="sm" variant="outline" type="button" onClick={() => setStep(1)}>
                        <AppIcons.edit aria-hidden />
                        {t("onboarding.contact.edit")}
                      </Button>
                    </div>
                    <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
                      <ReviewItem
                        label={t("onboarding.contact.phone")}
                        value={
                          parsedDetails.success
                            ? parsedDetails.data.primaryPhone
                            : shopDetails.primaryPhone
                        }
                      />
                      {shopDetails.additionalPhones.length ? (
                        <ReviewItem
                          label={t("onboarding.contact.addPhone")}
                          value={shopDetails.additionalPhones.join(" · ")}
                        />
                      ) : null}
                      {shopDetails.publicEmail ? (
                        <ReviewItem
                          label={t("onboarding.contact.email")}
                          value={shopDetails.publicEmail}
                        />
                      ) : null}
                      {shopDetails.address?.streetAddress || shopDetails.address?.city ? (
                        <ReviewItem
                          label={t("onboarding.contact.address")}
                          value={[
                            shopDetails.address.streetAddress,
                            shopDetails.address.city,
                            shopDetails.address.directions,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        />
                      ) : null}
                      {shopDetails.socialProfiles.length ? (
                        <ReviewItem
                          className="sm:col-span-2"
                          label={t("onboarding.contact.social")}
                          value={shopDetails.socialProfiles
                            .map((profile) => `${profile.platform}: ${profile.url}`)
                            .join(" · ")}
                        />
                      ) : null}
                      <ReviewItem
                        className="sm:col-span-2"
                        label={t("onboarding.reviewFulfillment")}
                        value={[
                          deliveryEnabled
                            ? t("onboarding.deliveryOn")
                            : t("onboarding.deliveryOff"),
                          pickupEnabled ? t("onboarding.pickupOn") : t("onboarding.pickupOff"),
                        ].join(" · ")}
                      />
                    </dl>
                  </section>
                  <section className="border-t p-5 sm:p-6">
                    <div className="mb-5 flex items-center justify-between gap-3">
                      <h3 className="text-sm font-semibold">{t("onboarding.storefrontStep")}</h3>
                      <Button size="sm" variant="outline" type="button" onClick={() => setStep(2)}>
                        <AppIcons.edit aria-hidden />
                        {t("onboarding.contact.edit")}
                      </Button>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-[11rem_minmax(0,1fr)] sm:items-center">
                      {selectedTemplate ? (
                        <StorefrontTemplatePreview
                          compact
                          demoLabel={t("common.viewDemo")}
                          previewLabel={t("common.preview")}
                          template={selectedTemplate}
                        />
                      ) : null}
                      <div className="min-w-0 space-y-4">
                        <ReviewItem
                          label={t("onboarding.selectedStorefront")}
                          value={selectedTemplate?.name ?? templateKey}
                        />
                        <div>
                          <p className="text-xs text-muted-foreground">
                            {t("onboarding.brand.title")}
                          </p>
                          <div className="mt-2 flex items-center gap-2">
                            {selectedBrand
                              ? Object.values(selectedBrand.colors)
                                  .slice(0, 4)
                                  .map((color) => (
                                    <span
                                      aria-hidden
                                      className="size-7 rounded-full border shadow-sm"
                                      key={color}
                                      style={{ backgroundColor: color }}
                                    />
                                  ))
                              : null}
                            <span className="ml-1 text-sm font-medium">
                              {t(`onboarding.brand.${shopDetails.brand?.presetId ?? "original"}`)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </section>
                </div>
              </div>
            </form>

            <div className="mt-6 flex flex-col gap-3 border-t pt-5 sm:mt-7 sm:pt-6">
              {/*
                Mobile: primary full-width on top (col-reverse), secondary under.
                Desktop: row with secondary left / primary right.
              */}
              <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between [&>button]:w-full sm:[&>button]:w-auto">
                <Button
                  disabled={step === 0 || isSubmitting}
                  onClick={goBack}
                  type="button"
                  variant="outline"
                >
                  {t("common.back")}
                </Button>
                {/* Keep Continue and Create as separate nodes to avoid accidental submit. */}
                <Button
                  className={step >= lastStep ? "hidden" : undefined}
                  disabled={!canContinue || isSubmitting}
                  onClick={goNext}
                  type="button"
                >
                  {t("common.continue")}
                </Button>
                <Button
                  aria-busy={isSubmitting}
                  className={step < lastStep ? "hidden" : undefined}
                  disabled={!canSubmit || isSubmitting}
                  form={formId}
                  type="submit"
                >
                  {isSubmitting ? <AppIcons.loader className="motion-safe:animate-spin" /> : null}
                  {isSubmitting ? t("onboarding.creatingShop") : t("onboarding.createShop")}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
