"use client";

import { useRouter } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  DialogStepPanel,
  DialogStepRail,
  getDialogStepStatus,
} from "@/components/app/dialog-step-rail";
import { AppIcons } from "@/components/app/icons";
import { Button } from "@/components/ui/button";
import { DateTimePicker } from "@/components/ui/datetime-picker";
import { useCreateQueryOpen } from "@/lib/use-create-query-open";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  ProductCatalogPickerDialog,
  ProductCatalogPickerTrigger,
  type ProductCatalogPickItem,
} from "@/features/products/product-catalog-picker-dialog";
import { useI18n } from "@/i18n/provider";
import { readPlatformErrorMessage } from "@/lib/platform-api/errors";
import { cn } from "@/lib/utils";

type OfferKind =
  | "percentage_order"
  | "fixed_order"
  | "percentage_items"
  | "fixed_items"
  | "buyget"
  | "free_shipping";

type CatalogProduct = {
  id: string;
  title: string | null;
  handle: string | null;
  thumbnail: string | null;
};

const offerOptionIds: OfferKind[] = [
  "percentage_order",
  "fixed_order",
  "percentage_items",
  "fixed_items",
  "buyget",
  "free_shipping",
];

const offerOptionMessageKeys: Record<
  OfferKind,
  { title: "offerOptions.percentageOrder.title" | "offerOptions.fixedOrder.title" | "offerOptions.percentageItems.title" | "offerOptions.fixedItems.title" | "offerOptions.buyget.title" | "offerOptions.freeShipping.title"; desc: "offerOptions.percentageOrder.desc" | "offerOptions.fixedOrder.desc" | "offerOptions.percentageItems.desc" | "offerOptions.fixedItems.desc" | "offerOptions.buyget.desc" | "offerOptions.freeShipping.desc" }
> = {
  percentage_order: {
    title: "offerOptions.percentageOrder.title",
    desc: "offerOptions.percentageOrder.desc",
  },
  fixed_order: {
    title: "offerOptions.fixedOrder.title",
    desc: "offerOptions.fixedOrder.desc",
  },
  percentage_items: {
    title: "offerOptions.percentageItems.title",
    desc: "offerOptions.percentageItems.desc",
  },
  fixed_items: {
    title: "offerOptions.fixedItems.title",
    desc: "offerOptions.fixedItems.desc",
  },
  buyget: { title: "offerOptions.buyget.title", desc: "offerOptions.buyget.desc" },
  free_shipping: {
    title: "offerOptions.freeShipping.title",
    desc: "offerOptions.freeShipping.desc",
  },
};

const emptyForm = {
  allocation: "each" as "each" | "across",
  applyToQuantity: "1",
  buyMinQuantity: "2",
  buyProductIds: [] as string[],
  campaignBudgetLimit: "",
  campaignBudgetType: "none" as "none" | "usage" | "spend",
  campaignName: "",
  code: "",
  currencyCode: "ETB",
  endsAt: "",
  isAutomatic: false,
  isTaxInclusive: false,
  maxQuantity: "",
  offerKind: "percentage_order" as OfferKind,
  productIds: [] as string[],
  startsAt: "",
  status: "active" as "active" | "inactive" | "draft",
  usageLimit: "",
  value: "",
};

export function PromotionCreateDialog() {
  return (
    <Suspense
      fallback={
        <Button type="button" disabled>
          …
        </Button>
      }
    >
      <PromotionCreateDialogInner />
    </Suspense>
  );
}

function PromotionCreateDialogInner() {
  const { t } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [catalog, setCatalog] = useState<CatalogProduct[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);

  useCreateQueryOpen({
    values: ["1", "true", "promotion"],
    onOpen: () => {
      setStep(0);
      setOpen(true);
    },
  });

  useEffect(() => {
    if (!open) return;
    setCatalogLoading(true);
    void fetch("/admin/products/actions/list?limit=100", {
      headers: { accept: "application/json" },
    })
      .then(async (response) => {
        const data = (await response.json().catch(() => ({}))) as {
          products?: Array<{
            id: string;
            title?: string | null;
            handle?: string | null;
            thumbnail?: string | null;
          }>;
        };
        setCatalog(
          response.ok && Array.isArray(data.products)
            ? data.products.map((product) => ({
                id: product.id,
                title: product.title ?? null,
                handle: product.handle ?? null,
                thumbnail: product.thumbnail ?? null,
              }))
            : [],
        );
      })
      .catch(() => setCatalog([]))
      .finally(() => setCatalogLoading(false));
  }, [open]);

  const needsProducts =
    form.offerKind === "percentage_items" ||
    form.offerKind === "fixed_items" ||
    form.offerKind === "buyget";

  const derived = useMemo(() => {
    switch (form.offerKind) {
      case "percentage_order":
        return {
          method: "percentage" as const,
          promotionType: "standard" as const,
          targetType: "order" as const,
          value: Number(form.value),
        };
      case "fixed_order":
        return {
          method: "fixed" as const,
          promotionType: "standard" as const,
          targetType: "order" as const,
          value: Number(form.value),
        };
      case "percentage_items":
        return {
          method: "percentage" as const,
          promotionType: "standard" as const,
          targetType: "items" as const,
          value: Number(form.value),
        };
      case "fixed_items":
        return {
          method: "fixed" as const,
          promotionType: "standard" as const,
          targetType: "items" as const,
          value: Number(form.value),
        };
      case "free_shipping":
        return {
          method: "percentage" as const,
          promotionType: "standard" as const,
          targetType: "shipping_methods" as const,
          value: 100,
        };
      case "buyget":
        return {
          method: "percentage" as const,
          promotionType: "buyget" as const,
          targetType: "items" as const,
          value: 100,
        };
    }
  }, [form.offerKind, form.value]);

  function reset() {
    setForm(emptyForm);
    setStep(0);
  }

  function canContinueFromDetails() {
    if (form.code.trim().length < 2) return false;
    if (form.offerKind !== "free_shipping" && form.offerKind !== "buyget") {
      if (!form.value || Number(form.value) <= 0) return false;
    }
    if (form.offerKind === "buyget") {
      if (!form.buyMinQuantity || Number(form.buyMinQuantity) < 1) return false;
      if (!form.applyToQuantity || Number(form.applyToQuantity) < 1) return false;
      if (form.productIds.length === 0) return false;
    }
    return true;
  }

  const promoSteps = useMemo(
    () => [
      {
        id: "type",
        label: t("promotions.create.stepShortType"),
        shortLabel: t("promotions.create.stepShortType"),
      },
      {
        id: "details",
        label: t("promotions.create.stepShortDetails"),
        shortLabel: t("promotions.create.stepShortDetails"),
      },
      {
        id: "schedule",
        label: t("promotions.create.stepShortSchedule"),
        shortLabel: t("promotions.create.stepShortSchedule"),
      },
    ],
    [t],
  );

  const completedStepIndexes = useMemo(() => {
    const done: number[] = [];
    if (step > 0) done.push(0);
    if (step > 1) done.push(1);
    return done;
  }, [step]);

  function goToStep(target: number) {
    if (target === step || target < 0 || target > 2) return;

    if (target < step) {
      setStep(target);
      return;
    }

    for (let i = step; i < target; i++) {
      // Step 0 (offer type) always has a default selection.
      if (i === 1 && !canContinueFromDetails()) {
        setStep(1);
        toast.error(t("promotions.create.guardDetails"));
        return;
      }
    }

    setStep(target);
  }

  async function create() {
    setSaving(true);
    const response = await fetch("/admin/promotions/actions", {
      body: JSON.stringify({
        allocation:
          derived.targetType === "items" || form.offerKind === "buyget" ? form.allocation : null,
        applyToQuantity:
          form.offerKind === "buyget" ? Number(form.applyToQuantity) || null : null,
        buyMinQuantity: form.offerKind === "buyget" ? Number(form.buyMinQuantity) || null : null,
        buyProductIds:
          form.offerKind === "buyget"
            ? form.buyProductIds.length
              ? form.buyProductIds
              : form.productIds
            : [],
        campaignBudgetLimit:
          form.campaignBudgetType !== "none" && form.campaignBudgetLimit
            ? Number(form.campaignBudgetLimit)
            : null,
        campaignBudgetType: form.campaignBudgetType === "none" ? null : form.campaignBudgetType,
        campaignName: form.campaignName.trim() || null,
        code: form.code,
        currencyCode: derived.method === "fixed" ? form.currencyCode : null,
        endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null,
        isAutomatic: form.isAutomatic,
        isTaxInclusive: form.isTaxInclusive,
        maxQuantity: form.maxQuantity
          ? Number(form.maxQuantity)
          : derived.targetType === "items" || form.offerKind === "buyget"
            ? form.allocation === "each"
              ? 1
              : null
            : null,
        method: derived.method,
        productIds: needsProducts ? form.productIds : [],
        promotionType: derived.promotionType,
        startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : null,
        status: form.status,
        targetType: derived.targetType,
        usageLimit: form.usageLimit ? Number(form.usageLimit) : null,
        value: derived.value,
      }),
      headers: { "content-type": "application/json" },
      method: "POST",
    }).catch(() => null);
    setSaving(false);
    if (!response?.ok) {
      toast.error(
        await readPlatformErrorMessage(response, {
          fallback: t("promotions.create.toastError"),
          resource: "Promotion",
        }),
      );
      return;
    }
    toast.success(t("promotions.create.toastSuccess"));
    setOpen(false);
    reset();
    router.refresh();
  }

  return (
    <Dialog
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
      open={open}
    >
      <DialogTrigger asChild>
        <Button type="button">
          <AppIcons.tag data-icon="inline-start" />
          {t("promotions.create.trigger")}
        </Button>
      </DialogTrigger>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="gap-1.5 border-b border-border/70 px-4 py-4 text-left sm:px-5">
          <DialogTitle>{t("promotions.create.trigger")}</DialogTitle>
          <DialogDescription>
            {t("promotions.create.dialogDescription")}
          </DialogDescription>
        </DialogHeader>
        <DialogStepRail
          ariaLabel={t("promotions.create.stepsAria")}
          currentId={promoSteps[step]?.id ?? "type"}
          getStatus={(_s, index) =>
            getDialogStepStatus({
              index,
              currentIndex: step,
              completedIndexes: completedStepIndexes,
            })
          }
          onSelect={(id) => {
            const index = promoSteps.findIndex((s) => s.id === id);
            if (index >= 0) goToStep(index);
          }}
          steps={promoSteps}
          variant="compact"
        />

        <div className="max-h-[min(70dvh,36rem)] overflow-y-auto p-4 sm:p-5">
          <DialogStepPanel stepKey={step}>
          {step === 0 ? (
            <div className="grid gap-2">
              {offerOptionIds.map((optionId) => {
                const option = {
                  id: optionId,
                  title: t(offerOptionMessageKeys[optionId].title),
                  description: t(offerOptionMessageKeys[optionId].desc),
                };
                const selected = form.offerKind === option.id;
                return (
                  <button
                    className={cn(
                      "rounded-xl border px-3.5 py-3 text-left transition-colors",
                      selected
                        ? "border-primary bg-primary/5"
                        : "hover:border-border hover:bg-muted/40",
                    )}
                    key={option.id}
                    onClick={() => setForm({ ...form, offerKind: option.id })}
                    type="button"
                  >
                    <p className="text-sm font-medium">{option.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{option.description}</p>
                  </button>
                );
              })}
            </div>
          ) : null}

          {step === 1 ? (
            <div className="space-y-5">
              <section className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <p className="text-sm font-medium">{t("promotions.create.basics")}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {t("promotions.create.basicsDesc")}
                  </p>
                </div>
                <Field className="sm:col-span-2">
                  <FieldLabel>{t("promotions.create.codeLabel")}</FieldLabel>
                  <Input
                    onChange={(event) =>
                      setForm({ ...form, code: event.target.value.toUpperCase().replace(/\s+/g, "") })
                    }
                    placeholder="WELCOME10"
                    required
                    value={form.code}
                  />
                  <FieldDescription>
                    {t("promotions.create.codeDesc")}
                  </FieldDescription>
                </Field>
                <Field>
                  <FieldLabel>{t("promotions.create.status")}</FieldLabel>
                  <Select
                    onValueChange={(value: "active" | "inactive" | "draft") =>
                      setForm({ ...form, status: value })
                    }
                    value={form.status}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="active">{t("promotions.create.statusActive")}</SelectItem>
                        <SelectItem value="draft">{t("promotions.create.statusDraft")}</SelectItem>
                        <SelectItem value="inactive">{t("promotions.create.statusInactive")}</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel>{t("promotions.create.usageLimit")}</FieldLabel>
                  <Input
                    min="1"
                    onChange={(event) => setForm({ ...form, usageLimit: event.target.value })}
                    placeholder={t("promotions.create.unlimited")}
                    type="number"
                    value={form.usageLimit}
                  />
                  <FieldDescription>{t("promotions.create.usageLimitDesc")}</FieldDescription>
                </Field>
                <Field className="flex flex-row items-center justify-between gap-4 rounded-xl border px-3.5 py-3 sm:col-span-2">
                  <div className="min-w-0 space-y-1">
                    <FieldLabel className="text-sm" htmlFor="promo-automatic">
                      {t("promotions.create.autoLabel")}
                    </FieldLabel>
                    <FieldDescription className="text-xs">
                      {t("promotions.create.autoDesc")}
                    </FieldDescription>
                  </div>
                  <Switch
                    checked={form.isAutomatic}
                    id="promo-automatic"
                    onCheckedChange={(isAutomatic) => setForm({ ...form, isAutomatic })}
                  />
                </Field>
                {form.offerKind !== "buyget" && form.offerKind !== "free_shipping" ? (
                  <Field className="flex flex-row items-center justify-between gap-4 rounded-xl border px-3.5 py-3 sm:col-span-2">
                    <div className="min-w-0 space-y-1">
                      <FieldLabel className="text-sm" htmlFor="promo-tax">
                        {t("promotions.create.taxLabel")}
                      </FieldLabel>
                      <FieldDescription className="text-xs">
                        {t("promotions.create.taxDesc")}
                      </FieldDescription>
                    </div>
                    <Switch
                      checked={form.isTaxInclusive}
                      id="promo-tax"
                      onCheckedChange={(isTaxInclusive) => setForm({ ...form, isTaxInclusive })}
                    />
                  </Field>
                ) : null}
              </section>

              {form.offerKind !== "free_shipping" && form.offerKind !== "buyget" ? (
                <section className="grid gap-4 border-t pt-5 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <p className="text-sm font-medium">{t("promotions.create.valueTitle")}</p>
                  </div>
                  <Field>
                    <FieldLabel>
                      {derived.method === "percentage" ? t("promotions.create.percentOff") : t("promotions.create.amountOff")}
                    </FieldLabel>
                    <Input
                      min="0.01"
                      onChange={(event) => setForm({ ...form, value: event.target.value })}
                      placeholder={derived.method === "percentage" ? "10" : "50"}
                      required
                      step="0.01"
                      type="number"
                      value={form.value}
                    />
                  </Field>
                  {derived.targetType === "items" ? (
                    <>
                      <Field>
                        <FieldLabel>{t("promotions.create.maxQty")}</FieldLabel>
                        <Input
                          min="1"
                          onChange={(event) => setForm({ ...form, maxQuantity: event.target.value })}
                          placeholder={t("promotions.create.noMax")}
                          type="number"
                          value={form.maxQuantity}
                        />
                        <FieldDescription>
                          {t("promotions.create.maxQtyDesc")}
                        </FieldDescription>
                      </Field>
                      <Field>
                        <FieldLabel>{t("promotions.create.allocation")}</FieldLabel>
                        <Select
                          onValueChange={(value: "each" | "across") =>
                            setForm({ ...form, allocation: value })
                          }
                          value={form.allocation}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              <SelectItem value="each">{t("promotions.create.allocEach")}</SelectItem>
                              <SelectItem value="across">{t("promotions.create.allocAcross")}</SelectItem>
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                        <FieldDescription>
                          {t("promotions.create.allocDesc")}
                        </FieldDescription>
                      </Field>
                    </>
                  ) : null}
                </section>
              ) : null}

              {form.offerKind === "buyget" ? (
                <section className="grid gap-4 border-t pt-5 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <p className="text-sm font-medium">{t("offerOptions.buyget.title")}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {t("promotions.create.buyGetDesc")}
                    </p>
                  </div>
                  <Field>
                    <FieldLabel>{t("promotions.create.buyQty")}</FieldLabel>
                    <Input
                      min="1"
                      onChange={(event) => setForm({ ...form, buyMinQuantity: event.target.value })}
                      type="number"
                      value={form.buyMinQuantity}
                    />
                  </Field>
                  <Field>
                    <FieldLabel>{t("promotions.create.getQty")}</FieldLabel>
                    <Input
                      min="1"
                      onChange={(event) => setForm({ ...form, applyToQuantity: event.target.value })}
                      type="number"
                      value={form.applyToQuantity}
                    />
                  </Field>
                </section>
              ) : null}

              {needsProducts ? (
                <section className="space-y-3 border-t pt-5">
                  <div>
                    <p className="text-sm font-medium">
                      {form.offerKind === "buyget"
                        ? t("promotions.create.prodTitleCount")
                        : t("promotions.create.prodTitleApply")}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {t("promotions.create.prodDescCommon")}
                      {form.offerKind === "buyget"
                        ? t("promotions.create.prodDescBuyGet")
                        : ""}
                    </p>
                  </div>
                  <ProductMultiPicker
                    catalog={catalog}
                    loading={catalogLoading}
                    onChange={(productIds) => setForm({ ...form, productIds })}
                    selectedIds={form.productIds}
                  />
                  {form.offerKind === "buyget" ? (
                    <div className="space-y-2">
                      <p className="text-sm font-medium">{t("promotions.create.freeProdTitle")}</p>
                      <p className="text-xs text-muted-foreground">
                        {t("promotions.create.freeProdDesc")}
                      </p>
                      <ProductMultiPicker
                        catalog={catalog}
                        loading={catalogLoading}
                        onChange={(buyProductIds) => setForm({ ...form, buyProductIds })}
                        selectedIds={form.buyProductIds}
                      />
                    </div>
                  ) : null}
                </section>
              ) : null}
            </div>
          ) : null}

          {step === 2 ? (
            <div className="space-y-5">
              <section className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <p className="text-sm font-medium">{t("promotions.create.scheduleTitle")}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {t("promotions.create.schedDesc")}
                  </p>
                </div>
                <Field className="sm:col-span-2">
                  <FieldLabel>{t("promotions.create.campName")}</FieldLabel>
                  <Input
                    onChange={(event) => setForm({ ...form, campaignName: event.target.value })}
                    placeholder={form.code || t("promotions.create.campaignPlaceholder")}
                    value={form.campaignName}
                  />
                  <FieldDescription>
                    {t("promotions.create.campNameDesc")}
                  </FieldDescription>
                </Field>
                <Field>
                  <FieldLabel>{t("promotions.create.startsLabel")}</FieldLabel>
                  <DateTimePicker
                    onChange={(startsAt) => setForm({ ...form, startsAt })}
                    placeholder={t("promotions.create.optionalStart")}
                    value={form.startsAt}
                  />
                </Field>
                <Field>
                  <FieldLabel>{t("promotions.create.endsLabel")}</FieldLabel>
                  <DateTimePicker
                    onChange={(endsAt) => setForm({ ...form, endsAt })}
                    placeholder={t("promotions.create.optionalEnd")}
                    value={form.endsAt}
                  />
                </Field>
              </section>

              <section className="grid gap-4 border-t pt-5 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <p className="text-sm font-medium">{t("promotions.create.budgetTitle")}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {t("promotions.create.budgetDesc")}
                  </p>
                </div>
                <Field>
                  <FieldLabel>{t("promotions.create.budgetType")}</FieldLabel>
                  <Select
                    onValueChange={(value: "none" | "usage" | "spend") =>
                      setForm({ ...form, campaignBudgetType: value })
                    }
                    value={form.campaignBudgetType}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="none">{t("promotions.create.budgetNone")}</SelectItem>
                        <SelectItem value="usage">{t("promotions.create.budgetUsage")}</SelectItem>
                        <SelectItem
                          disabled={form.offerKind === "buyget" || form.offerKind === "free_shipping"}
                          value="spend"
                        >
                          {t("promotions.create.budgetSpend")}
                        </SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
                {form.campaignBudgetType !== "none" ? (
                  <Field>
                    <FieldLabel>
                      {form.campaignBudgetType === "usage" ? t("promotions.create.maxUses") : t("promotions.create.maxSpend")}
                    </FieldLabel>
                    <Input
                      min="1"
                      onChange={(event) =>
                        setForm({ ...form, campaignBudgetLimit: event.target.value })
                      }
                      type="number"
                      value={form.campaignBudgetLimit}
                    />
                  </Field>
                ) : null}
              </section>
            </div>
          ) : null}
          </DialogStepPanel>
        </div>

        <DialogFooter className="m-0 rounded-b-xl border-t border-border/70 bg-muted/40 p-4">
          {step > 0 ? (
            <Button onClick={() => goToStep(step - 1)} type="button" variant="outline">
              {t("common.back")}
            </Button>
          ) : (
            <Button onClick={() => setOpen(false)} type="button" variant="outline">
              {t("common.cancel")}
            </Button>
          )}
          {step < 2 ? (
            <Button
              disabled={step === 1 && !canContinueFromDetails()}
              onClick={() => goToStep(step + 1)}
              type="button"
            >
              {t("common.continue")}
            </Button>
          ) : (
            <Button
              disabled={saving || !canContinueFromDetails()}
              onClick={() => void create()}
              type="button"
            >
              {saving ? t("promotions.create.creating") : t("promotions.create.trigger")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ProductMultiPicker({
  catalog,
  loading,
  onChange,
  selectedIds,
}: {
  catalog: CatalogProduct[];
  loading: boolean;
  onChange: (ids: string[]) => void;
  selectedIds: string[];
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const items = useMemo<ProductCatalogPickItem[]>(
    () =>
      catalog.map((product) => ({
        id: product.id,
        title: product.title ?? product.handle ?? product.id,
        subtitle: product.handle ? `/${product.handle}` : null,
        thumbnailUrl: product.thumbnail,
        searchText: [product.title, product.handle, product.id].filter(Boolean).join(" "),
      })),
    [catalog],
  );

  return (
    <>
      <ProductCatalogPickerTrigger
        loading={loading}
        onClick={() => setOpen(true)}
        selectedCount={selectedIds.length}
      />
      <ProductCatalogPickerDialog
        items={items}
        loading={loading}
        onConfirm={onChange}
        onOpenChange={setOpen}
        open={open}
        selectedIds={selectedIds}
        selectionMode="multiple"
        title={t("common.selectProducts")}
      />
    </>
  );
}
