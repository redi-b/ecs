"use client";

import type { StorefrontTemplateCatalogItem } from "@ecs/contracts";
import { useEffect, useId, useMemo, useState } from "react";

import { AppIcons } from "@/components/app/icons";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { MessageKey } from "@/i18n/messages";
import { useI18n } from "@/i18n/provider";
import { getStorefrontHostname } from "@/lib/storefront-hosts";
import { cn } from "@/lib/utils";

type HandleState =
  | {
      status: "idle";
      message: string;
    }
  | {
      status: "checking";
      message: string;
    }
  | {
      status: "available";
      message: string;
      hostname: string;
    }
  | {
      status: "unavailable";
      message: string;
    };

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
  const steps = [
    {
      title: t("onboarding.shopStep"),
      description: t("onboarding.shopStepDescription"),
    },
    {
      title: t("onboarding.storefrontStep"),
      description: t("onboarding.storefrontStepDescription"),
    },
    {
      title: t("onboarding.reviewStep"),
      description: t("onboarding.reviewStepDescription"),
    },
  ] as const;
  const [step, setStep] = useState(0);
  const [shopName, setShopName] = useState(defaultValues.shopName ?? "");
  const [handle, setHandle] = useState(defaultValues.handle ?? "");
  const [handleTouched, setHandleTouched] = useState(Boolean(defaultValues.handle));
  const [templateKey, setTemplateKey] = useState(templates[0]?.version.templateKey ?? "");
  const [businessCategory, setBusinessCategory] = useState(defaultValues.businessCategory ?? "");
  const [contactPhone, setContactPhone] = useState(defaultValues.contactPhone ?? "");
  const [handleState, setHandleState] = useState<HandleState>({
    status: "idle",
    message: t("onboarding.handle.choose"),
  });
  const selectedTemplate = useMemo(
    () =>
      templates.find((template) => template.version.templateKey === templateKey) ?? templates[0],
    [templateKey, templates],
  );

  useEffect(() => {
    if (handleTouched) return;
    setHandle(slugify(shopName));
  }, [handleTouched, shopName]);

  useEffect(() => {
    if (defaultValues.shopName || defaultValues.handle) return;
    const draft = window.localStorage.getItem("ecs:onboarding-draft");
    if (!draft) return;
    try {
      const value = JSON.parse(draft) as Record<string, string>;
      setShopName(value.shopName ?? "");
      setHandle(value.handle ?? "");
      setHandleTouched(Boolean(value.handle));
      setBusinessCategory(value.businessCategory ?? "");
      setContactPhone(value.contactPhone ?? "");
      if (
        value.templateKey &&
        templates.some((item) => item.version.templateKey === value.templateKey)
      )
        setTemplateKey(value.templateKey);
    } catch {
      window.localStorage.removeItem("ecs:onboarding-draft");
    }
  }, [defaultValues.handle, defaultValues.shopName, templates]);

  useEffect(() => {
    window.localStorage.setItem(
      "ecs:onboarding-draft",
      JSON.stringify({ businessCategory, contactPhone, handle, shopName, templateKey }),
    );
  }, [businessCategory, contactPhone, handle, shopName, templateKey]);

  useEffect(() => {
    const normalized = slugify(handle);

    if (!normalized) {
      setHandleState({
        status: "idle",
        message: t("onboarding.handle.choose"),
      });
      return;
    }

    if (normalized !== handle) {
      setHandle(normalized);
      return;
    }

    setHandleState({
      status: "checking",
      message: t("onboarding.handle.checking"),
    });

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      const response = await fetch(
        `/admin/onboarding/handle?handle=${encodeURIComponent(normalized)}`,
        {
          signal: controller.signal,
        },
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

  const canContinue =
    (step === 0 && shopName.trim() && handleState.status === "available") ||
    (step === 1 && templateKey) ||
    step === 2;

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <Card className="rounded-2xl border-border/80 bg-card/95 shadow-sm">
        <CardHeader className="border-b">
          <CardTitle className="text-xl">{t("onboarding.setupTitle")}</CardTitle>
          <CardDescription>{t("onboarding.setupDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="flex min-h-[34rem] flex-col gap-6 pt-5">
          <div className="grid gap-2 sm:grid-cols-3">
            {steps.map((item, index) => (
              <button
                aria-current={step === index ? "step" : undefined}
                className={cn(
                  "rounded-xl border px-3 py-2 text-left transition",
                  step === index
                    ? "border-primary bg-primary/8 text-foreground"
                    : "border-border bg-muted/30 text-muted-foreground hover:border-ring/60",
                )}
                key={item.title}
                onClick={() => setStep(index)}
                type="button"
              >
                <span className="flex items-center gap-2 text-sm font-medium">
                  <span className="flex size-5 items-center justify-center rounded-full bg-background text-xs ring-1 ring-border">
                    {index + 1}
                  </span>
                  {item.title}
                </span>
                <span className="mt-1 block text-xs">{item.description}</span>
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-primary transition-[width]"
                style={{ width: `${((step + 1) / steps.length) * 100}%` }}
              />
            </div>
            <span className="text-xs font-medium text-muted-foreground">
              {t("onboarding.estimatedTime")}
            </span>
          </div>

          {errorMessage ? (
            <Alert variant="destructive">
              <AppIcons.error />
              <AlertTitle>{t("onboarding.paused")}</AlertTitle>
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          ) : null}

          <form
            action="/admin/onboarding/submit"
            className="flex flex-1 flex-col gap-6"
            method="post"
            onSubmit={() => window.localStorage.removeItem("ecs:onboarding-draft")}
          >
            <div className="flex-1">
              <div className={cn("grid gap-4", step === 0 ? "block" : "hidden")}>
                <Field>
                  <FieldLabel htmlFor={`${fieldId}-shopName`}>
                    {t("onboarding.shopName")}
                  </FieldLabel>
                  <Input
                    autoComplete="organization"
                    className="h-11 rounded-full px-3"
                    id={`${fieldId}-shopName`}
                    name="shopName"
                    onChange={(event) => setShopName(event.target.value)}
                    placeholder="Addis Pantry"
                    required
                    value={shopName}
                  />
                </Field>
                <div className="grid gap-2">
                  <Field data-invalid={handleState.status === "unavailable" ? true : undefined}>
                    <FieldLabel htmlFor={`${fieldId}-handle`}>
                      {t("onboarding.shopAddress")}
                    </FieldLabel>
                    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_13rem] sm:items-center">
                      <Input
                        className="h-11 rounded-full px-3"
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
                      <div className="flex h-11 items-center justify-between gap-3 rounded-full border bg-muted/30 px-4 text-sm">
                        <span className="text-xs text-muted-foreground">{t("common.preview")}</span>
                        <span className="min-w-0 truncate font-medium">
                          {handleState.status === "available"
                            ? handleState.hostname
                            : getStorefrontHostname(handle || "shop", storefrontBaseDomain)}
                        </span>
                      </div>
                    </div>
                    {handleState.status === "unavailable" ? (
                      <FieldError>{handleState.message}</FieldError>
                    ) : (
                      <FieldDescription>{handleState.message}</FieldDescription>
                    )}
                  </Field>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor={`${fieldId}-businessCategory`}>
                      {t("onboarding.category")}
                    </FieldLabel>
                    <Input
                      className="h-11 rounded-full px-3"
                      id={`${fieldId}-businessCategory`}
                      name="businessCategory"
                      onChange={(event) => setBusinessCategory(event.target.value)}
                      placeholder={t("onboarding.categoryPlaceholder")}
                      value={businessCategory}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor={`${fieldId}-contactPhone`}>
                      {t("onboarding.contactPhone")}
                    </FieldLabel>
                    <Input
                      autoComplete="tel"
                      className="h-11 rounded-full px-3"
                      id={`${fieldId}-contactPhone`}
                      name="contactPhone"
                      onChange={(event) => setContactPhone(event.target.value)}
                      placeholder="+251..."
                      value={contactPhone}
                    />
                  </Field>
                </div>
              </div>

              <div className={cn("grid gap-4", step === 2 ? "block" : "hidden")}>
                <div className="rounded-2xl border bg-muted/20 p-5">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">{t("onboarding.reviewTitle")}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {t("onboarding.reviewDescription")}
                      </p>
                    </div>
                    <Badge variant="secondary">{t("onboarding.ready")}</Badge>
                  </div>
                  <dl className="grid gap-4 sm:grid-cols-2">
                    <ReviewItem label={t("onboarding.shopName")} value={shopName} />
                    <ReviewItem
                      label={t("onboarding.shopAddress")}
                      value={handleState.status === "available" ? handleState.hostname : handle}
                    />
                    <ReviewItem
                      label={t("onboarding.category")}
                      value={businessCategory || t("common.notSet")}
                    />
                    <ReviewItem
                      label={t("onboarding.contactPhone")}
                      value={contactPhone || t("common.notSet")}
                    />
                    <ReviewItem
                      label={t("onboarding.selectedStorefront")}
                      value={selectedTemplate?.name ?? templateKey}
                    />
                  </dl>
                </div>
                <Alert>
                  <AppIcons.check />
                  <AlertTitle>{t("onboarding.recoverableTitle")}</AlertTitle>
                  <AlertDescription>{t("onboarding.recoverableDescription")}</AlertDescription>
                </Alert>
              </div>

              <div className={cn("grid gap-4", step === 1 ? "block" : "hidden")}>
                <input name="templateKey" type="hidden" value={templateKey} />
                <div className="grid gap-3 md:grid-cols-2">
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
            </div>

            <div className="flex flex-col gap-3 border-t pt-5 sm:flex-row sm:items-center sm:justify-between">
              <Button
                className="justify-start px-0"
                formAction="/admin/sign-out"
                formMethod="post"
                formNoValidate
                type="submit"
                variant="link"
              >
                {t("onboarding.otherAccount")}
              </Button>
              <div className="flex gap-2">
                <Button
                  disabled={step === 0}
                  onClick={() => setStep((value) => Math.max(0, value - 1))}
                  type="button"
                  variant="outline"
                >
                  {t("common.back")}
                </Button>
                {step < steps.length - 1 ? (
                  <Button
                    disabled={!canContinue}
                    onClick={() => setStep((value) => Math.min(steps.length - 1, value + 1))}
                    type="button"
                  >
                    {t("common.continue")}
                  </Button>
                ) : (
                  <Button
                    disabled={!canContinue || handleState.status !== "available"}
                    type="submit"
                  >
                    {t("onboarding.createShop")}
                  </Button>
                )}
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      <aside className="space-y-4">
        <Card className="rounded-2xl border-border/80 bg-card/95 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">{t("onboarding.whatNext")}</CardTitle>
            <CardDescription>{t("onboarding.whatNextDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              t("onboarding.workspace"),
              t("onboarding.startingPoint"),
              t("onboarding.secureDashboard"),
              t("onboarding.launchAssistant"),
            ].map((item) => (
              <div className="flex items-center gap-2 text-sm" key={item}>
                <span className="flex size-6 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <AppIcons.check className="size-4" />
                </span>
                {item}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/80 bg-card/95 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">{t("onboarding.selectedStorefront")}</CardTitle>
            <CardDescription>
              {selectedTemplate?.name ?? t("onboarding.chooseTemplate")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <StorefrontPreview template={selectedTemplate ?? null} />
            <div className="mt-3 flex flex-wrap gap-1.5">
              {getTemplateTags(selectedTemplate).map((tag) => (
                <Badge className="bg-primary/8 text-primary" key={tag} variant="secondary">
                  {tag}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/80 bg-card/95 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">{t("onboarding.afterSetup")}</CardTitle>
            <CardDescription>{t("onboarding.afterSetupDescription")}</CardDescription>
          </CardHeader>
        </Card>
      </aside>
    </div>
  );
}

function ReviewItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-1 truncate text-sm font-medium">{value}</dd>
    </div>
  );
}

function TemplateOption({
  checked,
  onSelect,
  template,
}: {
  checked: boolean;
  onSelect: () => void;
  template: StorefrontTemplateCatalogItem;
}) {
  return (
    <button
      className={cn(
        "rounded-2xl border p-3 text-left transition",
        checked
          ? "border-primary bg-primary/8 shadow-sm"
          : "border-border bg-muted/20 hover:border-ring/70",
      )}
      onClick={onSelect}
      type="button"
    >
      <StorefrontPreview template={template} />
      <div className="mt-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">{template.name}</p>
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{template.description}</p>
        </div>
        <span
          className={cn(
            "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border",
            checked
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-background",
          )}
        >
          {checked ? <AppIcons.check className="size-3.5" /> : null}
        </span>
      </div>
    </button>
  );
}

function StorefrontPreview({ template }: { template: StorefrontTemplateCatalogItem | null }) {
  return (
    <div className="relative aspect-[16/10] overflow-hidden rounded-xl border bg-muted/45">
      <div className="absolute inset-x-3 top-3 flex items-center justify-between">
        <span className="h-2 w-16 rounded-full bg-foreground/20" />
        <span className="h-2 w-9 rounded-full bg-primary/60" />
      </div>
      <div className="absolute inset-x-3 bottom-3 grid grid-cols-[1.3fr_0.7fr] gap-2">
        <div className="rounded-lg bg-background/85 p-2 shadow-sm">
          <span className="block h-2 w-20 rounded-full bg-foreground/30" />
          <span className="mt-2 block h-2 w-28 rounded-full bg-muted-foreground/20" />
          <span className="mt-3 block h-5 w-16 rounded-full bg-primary/70" />
        </div>
        <div className="grid gap-2">
          <span className="rounded-lg bg-background/75" />
          <span className="rounded-lg bg-background/60" />
        </div>
      </div>
      <span className="absolute left-3 top-8 rounded-full bg-background/80 px-2 py-1 text-[10px] font-medium text-muted-foreground">
        {template?.slug ?? "storefront"}
      </span>
    </div>
  );
}

function getTemplateTags(template: StorefrontTemplateCatalogItem | null | undefined) {
  const tags = template?.tags;

  return Array.isArray(tags)
    ? tags.filter((tag): tag is string => typeof tag === "string").slice(0, 4)
    : [];
}

function getHandleReason(reason: string | undefined, t: (key: MessageKey) => string) {
  if (reason === "taken") return t("onboarding.handle.taken");
  if (reason === "reserved") return t("onboarding.handle.reserved");
  if (reason === "invalid") return t("onboarding.handle.invalid");
  return t("onboarding.handle.unavailable");
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}
