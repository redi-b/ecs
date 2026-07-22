"use client";

import type { StorefrontTemplateCatalogItem } from "@ecs/contracts";
import { useEffect, useId, useMemo, useState } from "react";

import { AppIcons } from "@/components/app/icons";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  CategoryCombobox,
  HandleStatus,
  PreferenceToggle,
  ReviewItem,
  TemplateOption,
} from "@/components/onboarding/onboarding-form-parts";
import {
  getHandleReason,
  mapOnboardingError,
  ONBOARDING_DRAFT_KEY,
  parseCategories,
  serializeCategories,
  slugify,
  type HandleState,
} from "@/components/onboarding/onboarding-helpers";
import { useI18n } from "@/i18n/provider";
import { getStorefrontHostname } from "@/lib/storefront-hosts";
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
  const [shopName, setShopName] = useState(defaultValues.shopName ?? "");
  const [handle, setHandle] = useState(defaultValues.handle ?? "");
  const [handleTouched, setHandleTouched] = useState(Boolean(defaultValues.handle));
  const [templateKey, setTemplateKey] = useState(templates[0]?.version.templateKey ?? "");
  const [businessCategories, setBusinessCategories] = useState<string[]>(() =>
    parseCategories(defaultValues.businessCategory),
  );
  const [contactPhone, setContactPhone] = useState(defaultValues.contactPhone ?? "");
  const [deliveryEnabled, setDeliveryEnabled] = useState(true);
  const [pickupEnabled, setPickupEnabled] = useState(true);
  const [phoneConfirmationRequired, setPhoneConfirmationRequired] = useState(true);
  const [handleState, setHandleState] = useState<HandleState>({
    status: "idle",
    message: t("onboarding.handle.choose"),
  });
  const [submitError, setSubmitError] = useState<string | null>(errorMessage);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const businessCategory = serializeCategories(businessCategories);

  const selectedTemplate = useMemo(
    () =>
      templates.find((template) => template.version.templateKey === templateKey) ?? templates[0],
    [templateKey, templates],
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
    if (defaultValues.shopName || defaultValues.handle) return;
    const draft = window.localStorage.getItem(ONBOARDING_DRAFT_KEY);
    if (!draft) return;
    try {
      const value = JSON.parse(draft) as Record<string, string>;
      setShopName(value.shopName ?? "");
      setHandle(value.handle ?? "");
      setHandleTouched(Boolean(value.handle));
      setBusinessCategories(parseCategories(value.businessCategory));
      setContactPhone(value.contactPhone ?? "");
      if (
        value.templateKey &&
        templates.some((item) => item.version.templateKey === value.templateKey)
      ) {
        setTemplateKey(value.templateKey);
      }
    } catch {
      window.localStorage.removeItem(ONBOARDING_DRAFT_KEY);
    }
  }, [defaultValues.handle, defaultValues.shopName, templates]);

  useEffect(() => {
    window.localStorage.setItem(
      ONBOARDING_DRAFT_KEY,
      JSON.stringify({
        businessCategory: serializeCategories(businessCategories),
        contactPhone,
        handle,
        shopName,
        templateKey,
      }),
    );
  }, [businessCategories, contactPhone, handle, shopName, templateKey]);

  useEffect(() => {
    const normalized = slugify(handle);

    if (!normalized) {
      setHandleState({ status: "idle", message: t("onboarding.handle.choose") });
      return;
    }

    if (normalized !== handle) {
      setHandle(normalized);
      return;
    }

    setHandleState({ status: "checking", message: t("onboarding.handle.checking") });

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      const response = await fetch(
        `/admin/onboarding/handle?handle=${encodeURIComponent(normalized)}`,
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

  const canContinueShop = Boolean(shopName.trim()) && handleState.status === "available";
  const canContinueStorefront = Boolean(templateKey);
  const canContinue =
    (step === 0 && canContinueShop) || (step === 1 && canContinueStorefront) || step === 2;
  const canSubmit = canContinueShop && canContinueStorefront && handleState.status === "available";

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
    window.localStorage.removeItem(ONBOARDING_DRAFT_KEY);

    const response = await fetch("/admin/onboarding/submit", {
      body: JSON.stringify({
        businessCategory: businessCategory || undefined,
        contactPhone: contactPhone.trim() || undefined,
        deliveryEnabled,
        handle,
        phoneConfirmationRequired,
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
    } | null;

    if (!response?.ok || !data?.ok || !data.redirectTo) {
      setSubmitError(mapOnboardingError(data?.error, t));
      setIsSubmitting(false);
      return;
    }

    window.location.assign(data.redirectTo);
  }

  async function signOutToOtherAccount() {
    if (isSigningOut || isSubmitting) return;
    setIsSigningOut(true);
    const response = await fetch("/admin/sign-out", {
      headers: { accept: "application/json" },
      method: "POST",
    }).catch(() => null);
    const data = (await response?.json().catch(() => null)) as { redirectTo?: string } | null;
    window.location.assign(data?.redirectTo ?? "/admin/sign-in");
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
                      !active &&
                        !complete &&
                        "bg-muted text-muted-foreground ring-1 ring-border",
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
            <div className="flex flex-wrap items-start justify-between gap-3 sm:gap-4">
              <div className="min-w-0 max-w-xl">
                <p className="text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">
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
              <Badge className="hidden shrink-0 font-medium sm:inline-flex" variant="secondary">
                {t("onboarding.estimatedTime")}
              </Badge>
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
              id="onboarding-setup-form"
              onSubmit={(event) => void submitOnboarding(event)}
            >
              <div className={cn(step === 0 ? "grid gap-6" : "hidden")}>
                <Field>
                  <FieldLabel htmlFor={`${fieldId}-shopName`}>{t("onboarding.shopName")}</FieldLabel>
                  <Input
                    autoComplete="organization"
                    autoFocus={step === 0}
                    className="h-11 rounded-xl px-3.5"
                    id={`${fieldId}-shopName`}
                    name="shopName"
                    onChange={(event) => setShopName(event.target.value)}
                    placeholder="Addis Pantry"
                    required
                    value={shopName}
                  />
                  <FieldDescription>{t("onboarding.shopNameHelp")}</FieldDescription>
                </Field>

                <Field data-invalid={handleState.status === "unavailable" ? true : undefined}>
                  <FieldLabel htmlFor={`${fieldId}-handle`}>
                    {t("onboarding.shopAddress")}
                  </FieldLabel>
                  <div className="overflow-hidden rounded-xl border border-input bg-background transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/25">
                    <div className="flex items-stretch">
                      <span className="hidden items-center border-r bg-muted/40 px-3.5 text-sm text-muted-foreground sm:flex">
                        https://
                      </span>
                      <Input
                        className="h-11 rounded-none border-0 bg-transparent px-3.5 shadow-none focus-visible:ring-0"
                        id={`${fieldId}-handle`}
                        name="handle"
                        onChange={(event) => {
                          setHandleTouched(true);
                          setHandle(event.target.value);
                        }}
                        pattern="[a-z0-9][a-z0-9-]{1,38}[a-z0-9]"
                        required
                        value={handle}
                      />
                    </div>
                    <div className="flex items-center justify-between gap-3 border-t bg-muted/20 px-3.5 py-2.5 text-xs sm:text-sm">
                      <span className="min-w-0 truncate font-medium tabular-nums text-foreground/90">
                        {previewHostname}
                      </span>
                      <HandleStatus status={handleState.status} />
                    </div>
                  </div>
                  {handleState.status === "unavailable" ? (
                    <FieldError>{handleState.message}</FieldError>
                  ) : (
                    <FieldDescription>{handleState.message}</FieldDescription>
                  )}
                </Field>

                <div className="grid gap-6 sm:grid-cols-2">
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
                    <FieldLabel htmlFor={`${fieldId}-contactPhone`}>
                      {t("onboarding.contactPhone")}
                    </FieldLabel>
                    <Input
                      autoComplete="tel"
                      className="h-11 rounded-xl px-3.5"
                      id={`${fieldId}-contactPhone`}
                      name="contactPhone"
                      onChange={(event) => setContactPhone(event.target.value)}
                      placeholder="+251..."
                      value={contactPhone}
                    />
                    <FieldDescription>{t("onboarding.contactPhoneHelp")}</FieldDescription>
                  </Field>
                </div>

                <div className="rounded-xl border border-border/90 p-4 sm:p-5">
                  <p className="text-sm font-semibold tracking-tight">Checkout preferences</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Starting defaults for how customers place orders. You can change these later in
                    Settings → Fulfillment.
                  </p>
                  <div className="mt-4 grid gap-3">
                    <PreferenceToggle
                      checked={deliveryEnabled}
                      description="Customers can request local delivery."
                      label="Offer delivery"
                      onCheckedChange={setDeliveryEnabled}
                    />
                    <PreferenceToggle
                      checked={pickupEnabled}
                      description="Customers can collect orders themselves."
                      label="Offer pickup"
                      onCheckedChange={setPickupEnabled}
                    />
                    <PreferenceToggle
                      checked={phoneConfirmationRequired}
                      description="Require a phone number before checkout."
                      label="Require phone number"
                      onCheckedChange={setPhoneConfirmationRequired}
                    />
                  </div>
                </div>
              </div>

              <div className={cn(step === 1 ? "grid gap-5" : "hidden")}>
                <input name="templateKey" type="hidden" value={templateKey} />
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {t("onboarding.templateHelp")}
                </p>
                <div className="grid gap-4">
                  {templates.map((template) => (
                    <TemplateOption
                      checked={template.version.templateKey === templateKey}
                      key={template.version.templateKey}
                      onSelect={() => setTemplateKey(template.version.templateKey)}
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
              </div>

              <div className={cn(step === 2 ? "grid gap-6" : "hidden")}>
                <section className="rounded-xl border border-border/90 bg-muted/15 p-6 sm:p-7">
                  <div className="mb-5 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold tracking-tight">
                        {t("onboarding.reviewTitle")}
                      </p>
                      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                        {t("onboarding.reviewDescription")}
                      </p>
                    </div>
                    <Badge variant="secondary">{t("onboarding.ready")}</Badge>
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
                    <ReviewItem
                      label={t("onboarding.contactPhone")}
                      value={contactPhone || t("common.notSet")}
                    />
                    <ReviewItem
                      className="sm:col-span-2"
                      label={t("onboarding.selectedStorefront")}
                      value={selectedTemplate?.name ?? templateKey}
                    />
                  </dl>
                </section>

                <section className="rounded-xl border border-border/90 p-6 sm:p-7">
                  <p className="text-sm font-semibold tracking-tight">
                    {t("onboarding.afterSetup")}
                  </p>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                    {t("onboarding.afterSetupDescription")}
                  </p>
                  <ul className="mt-5 grid gap-3 sm:grid-cols-2 sm:gap-x-6 sm:gap-y-3.5">
                    {[
                      t("onboarding.checklist.products"),
                      t("onboarding.checklist.media"),
                      t("onboarding.checklist.payments"),
                      t("onboarding.checklist.fulfillment"),
                    ].map((item) => (
                      <li className="flex items-start gap-2.5 text-sm" key={item}>
                        <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                          <AppIcons.check className="size-3" />
                        </span>
                        <span className="leading-snug text-foreground/90">{item}</span>
                      </li>
                    ))}
                  </ul>
                </section>

                <p className="text-xs leading-relaxed text-muted-foreground">
                  {t("onboarding.recoverableDescription")}
                </p>
              </div>

            </form>

            <div className="mt-6 flex flex-col gap-3 border-t pt-5 sm:mt-7 sm:pt-6">
              {/*
                Mobile: primary full-width on top (col-reverse), secondary under.
                Desktop: row with secondary left / primary right.
              */}
              <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
                <Button
                  className="w-full justify-center text-muted-foreground hover:text-foreground sm:w-auto sm:justify-start sm:px-0"
                  disabled={isSigningOut || isSubmitting}
                  onClick={() => void signOutToOtherAccount()}
                  type="button"
                  variant="link"
                >
                  {isSigningOut ? (
                    <>
                      <AppIcons.loader className="animate-spin" data-icon="inline-start" />
                      {t("account.signingOut")}
                    </>
                  ) : (
                    t("onboarding.otherAccount")
                  )}
                </Button>
                <div className="flex w-full flex-col-reverse gap-2 sm:w-auto sm:flex-row sm:[&>button]:w-auto [&>button]:w-full">
                  <Button
                    disabled={step === 0 || isSubmitting}
                    onClick={goBack}
                    type="button"
                    variant="outline"
                  >
                    {t("common.back")}
                  </Button>
                  {/*
                    Keep Continue and Create mounted separately. Swapping
                    type=button → type=submit on the same node causes the
                    browser to submit on the click that advances the step.
                  */}
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
                    form="onboarding-setup-form"
                    type="submit"
                  >
                    {isSubmitting ? (
                      <>
                        <AppIcons.loader className="animate-spin" data-icon="inline-start" />
                        {t("onboarding.creatingShop")}
                      </>
                    ) : (
                      t("onboarding.createShop")
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
