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
import { cn } from "@/lib/utils";

const steps = [
  {
    title: "Shop",
    description: "Name and address",
  },
  {
    title: "Storefront",
    description: "Starting point",
  },
] as const;

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
  templates,
}: {
  defaultValues: {
    businessCategory?: string | undefined;
    contactPhone?: string | undefined;
    handle?: string | undefined;
    shopName?: string | undefined;
  };
  errorMessage: string | null;
  templates: StorefrontTemplateCatalogItem[];
}) {
  const fieldId = useId();
  const [step, setStep] = useState(0);
  const [shopName, setShopName] = useState(defaultValues.shopName ?? "");
  const [handle, setHandle] = useState(defaultValues.handle ?? "");
  const [handleTouched, setHandleTouched] = useState(Boolean(defaultValues.handle));
  const [templateKey, setTemplateKey] = useState(templates[0]?.version.templateKey ?? "");
  const [handleState, setHandleState] = useState<HandleState>({
    status: "idle",
    message: "Choose a short shop address.",
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
    const normalized = slugify(handle);

    if (!normalized) {
      setHandleState({
        status: "idle",
        message: "Choose a short shop address.",
      });
      return;
    }

    if (normalized !== handle) {
      setHandle(normalized);
      return;
    }

    setHandleState({
      status: "checking",
      message: "Checking address...",
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
          message: "Address check failed.",
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
          message: getHandleReason(data.reason),
        });
        return;
      }

      setHandleState({
        status: "available",
        hostname: data.hostname ?? `${normalized}.lvh.me`,
        message: "Address available.",
      });
    }, 350);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [handle]);

  const canContinue =
    (step === 0 && shopName.trim() && handleState.status === "available") ||
    (step === 1 && templateKey);

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <Card className="rounded-2xl border-border/80 bg-card/95 shadow-sm">
        <CardHeader className="border-b">
          <CardTitle className="text-xl">Set up your shop</CardTitle>
          <CardDescription>
            Add the shop details and choose a storefront starting point.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex min-h-[34rem] flex-col gap-6 pt-5">
          <div className="grid gap-2 sm:grid-cols-2">
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

          {errorMessage ? (
            <Alert variant="destructive">
              <AppIcons.error />
              <AlertTitle>Shop setup paused</AlertTitle>
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          ) : null}

          <form
            action="/admin/onboarding/submit"
            className="flex flex-1 flex-col gap-6"
            method="post"
          >
            <div className="flex-1">
              <div className={cn("grid gap-4", step === 0 ? "block" : "hidden")}>
                <Field>
                  <FieldLabel htmlFor={`${fieldId}-shopName`}>Shop name</FieldLabel>
                  <Input
                    autoComplete="organization"
                    id={`${fieldId}-shopName`}
                    name="shopName"
                    onChange={(event) => setShopName(event.target.value)}
                    placeholder="Addis Pantry"
                    required
                    value={shopName}
                  />
                </Field>
                <div className="grid gap-4 sm:grid-cols-[1fr_12rem]">
                  <Field data-invalid={handleState.status === "unavailable" ? true : undefined}>
                    <FieldLabel htmlFor={`${fieldId}-handle`}>Shop address</FieldLabel>
                    <Input
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
                    {handleState.status === "unavailable" ? (
                      <FieldError>{handleState.message}</FieldError>
                    ) : (
                      <FieldDescription>{handleState.message}</FieldDescription>
                    )}
                  </Field>
                  <div className="rounded-xl border bg-muted/30 p-3">
                    <p className="text-xs text-muted-foreground">Preview</p>
                    <p className="mt-2 break-all text-sm font-medium">
                      {handleState.status === "available"
                        ? handleState.hostname
                        : `${handle || "shop"}.lvh.me`}
                    </p>
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor={`${fieldId}-businessCategory`}>Category</FieldLabel>
                    <Input
                      defaultValue={defaultValues.businessCategory}
                      id={`${fieldId}-businessCategory`}
                      name="businessCategory"
                      placeholder="Groceries, fashion, electronics"
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor={`${fieldId}-contactPhone`}>Contact phone</FieldLabel>
                    <Input
                      autoComplete="tel"
                      defaultValue={defaultValues.contactPhone}
                      id={`${fieldId}-contactPhone`}
                      name="contactPhone"
                      placeholder="+251..."
                    />
                  </Field>
                </div>
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
                    <AlertTitle>No storefronts available</AlertTitle>
                    <AlertDescription>
                      Shop setup needs an active storefront template.
                    </AlertDescription>
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
                Use another account
              </Button>
              <div className="flex gap-2">
                <Button
                  disabled={step === 0}
                  onClick={() => setStep((value) => Math.max(0, value - 1))}
                  type="button"
                  variant="outline"
                >
                  Back
                </Button>
                {step < steps.length - 1 ? (
                  <Button
                    disabled={!canContinue}
                    onClick={() => setStep((value) => Math.min(steps.length - 1, value + 1))}
                    type="button"
                  >
                    Continue
                  </Button>
                ) : (
                  <Button
                    disabled={!canContinue || handleState.status !== "available"}
                    type="submit"
                  >
                    Create shop
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
            <CardTitle className="text-base">Provisioning</CardTitle>
            <CardDescription>Created after this step.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {["Tenant shop", "Storefront draft", "Admin redirect", "Dashboard checklist"].map(
              (item) => (
                <div className="flex items-center gap-2 text-sm" key={item}>
                  <span className="flex size-6 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <AppIcons.check className="size-4" />
                  </span>
                  {item}
                </div>
              ),
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/80 bg-card/95 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Selected storefront</CardTitle>
            <CardDescription>{selectedTemplate?.name ?? "Choose a template"}</CardDescription>
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
            <CardTitle className="text-base">After setup</CardTitle>
            <CardDescription>
              Payments and fulfillment finish inside the dashboard checklist.
            </CardDescription>
          </CardHeader>
        </Card>
      </aside>
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
    <div className="relative aspect-[16/10] overflow-hidden rounded-xl border bg-gradient-to-br from-primary/15 via-chart-3/10 to-background">
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

function getHandleReason(reason: string | undefined) {
  if (reason === "taken") return "Address is already taken.";
  if (reason === "reserved") return "Address is reserved.";
  if (reason === "invalid") return "Use lowercase letters, numbers, and hyphens.";
  return "Address is unavailable.";
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}
