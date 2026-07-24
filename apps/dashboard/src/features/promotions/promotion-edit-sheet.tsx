"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { AppIcons } from "@/components/app/icons";
import { UnsavedChangesDialog } from "@/components/app/unsaved-changes-dialog";
import { Button } from "@/components/ui/button";
import { DateTimePicker } from "@/components/ui/datetime-picker";
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
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import {
  ProductCatalogPickerDialog,
  ProductCatalogPickerTrigger,
  type ProductCatalogPickItem,
} from "@/features/products/product-catalog-picker-dialog";
import { useUnsavedChangesGuard } from "@/hooks/use-unsaved-changes-guard";
import type { MessageKey } from "@/i18n/messages";
import { useI18n } from "@/i18n/provider";
import type { MerchantPromotion } from "@/lib/merchant-promotions";
import { readPlatformErrorMessage } from "@/lib/platform-api/errors";

type Translate = (key: MessageKey, values?: Record<string, string | number | Date>) => string;

type CatalogProduct = {
  id: string;
  title: string | null;
  handle: string | null;
  thumbnail: string | null;
};

function offerSummary(promotion: MerchantPromotion, t: Translate) {
  if (promotion.promotionType === "buyget") {
    return t("promotions.edit.buyGetSummary", {
      buy: promotion.buyMinQuantity ?? "X",
      get: promotion.applyToQuantity ?? "Y",
    });
  }
  if (
    promotion.targetType === "shipping_methods" &&
    promotion.method === "percentage" &&
    promotion.value >= 100
  ) {
    return t("promotions.edit.freeShipping");
  }
  const amount =
    promotion.method === "percentage"
      ? t("promotions.edit.percentOffSummary", { value: promotion.value })
      : t("promotions.edit.amountOffSummary", {
          value: promotion.value,
          currency: promotion.currencyCode?.toUpperCase() ?? "ETB",
        });
  const target =
    promotion.targetType === "items"
      ? t("promotions.edit.targetProducts")
      : promotion.targetType === "shipping_methods"
        ? t("promotions.edit.targetShipping")
        : t("promotions.edit.targetOrder");
  return `${amount} · ${target}`;
}

export function PromotionEditSheet({
  onOpenChange,
  open,
  promotion,
}: {
  onOpenChange: (open: boolean) => void;
  open: boolean;
  promotion: MerchantPromotion | null;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<MerchantPromotion["status"]>("active");
  const [isAutomatic, setIsAutomatic] = useState(false);
  const [isTaxInclusive, setIsTaxInclusive] = useState(false);
  const [value, setValue] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [campaignName, setCampaignName] = useState("");
  const [usageLimit, setUsageLimit] = useState("");
  const [maxQuantity, setMaxQuantity] = useState("");
  const [allocation, setAllocation] = useState<"each" | "across">("each");
  const [productIds, setProductIds] = useState<string[]>([]);
  const [buyProductIds, setBuyProductIds] = useState<string[]>([]);
  const [buyMinQuantity, setBuyMinQuantity] = useState("");
  const [applyToQuantity, setApplyToQuantity] = useState("");
  const [campaignBudgetType, setCampaignBudgetType] = useState<"none" | "usage" | "spend">("none");
  const [campaignBudgetLimit, setCampaignBudgetLimit] = useState("");
  const [saving, setSaving] = useState(false);
  const [catalog, setCatalog] = useState<CatalogProduct[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);

  const isBuyGet = promotion?.promotionType === "buyget";
  const isFreeShipping =
    promotion?.targetType === "shipping_methods" &&
    promotion.method === "percentage" &&
    promotion.value >= 100;
  const canEditValue = Boolean(promotion) && !isBuyGet && !isFreeShipping;
  const needsProducts = promotion?.targetType === "items" || isBuyGet;
  const showAllocation = needsProducts && !isBuyGet;

  useEffect(() => {
    if (!promotion || !open) return;
    setCode(promotion.code);
    setStatus(promotion.status);
    setIsAutomatic(promotion.isAutomatic);
    setIsTaxInclusive(promotion.isTaxInclusive);
    setValue(String(promotion.value));
    setStartsAt(promotion.startsAt ? toLocalInput(promotion.startsAt) : "");
    setEndsAt(promotion.endsAt ? toLocalInput(promotion.endsAt) : "");
    setCampaignName(promotion.campaignName ?? "");
    setUsageLimit(promotion.usageLimit != null ? String(promotion.usageLimit) : "");
    setMaxQuantity(promotion.maxQuantity != null ? String(promotion.maxQuantity) : "");
    setAllocation("each");
    setProductIds(promotion.productIds ?? []);
    setBuyProductIds(promotion.buyProductIds ?? []);
    setBuyMinQuantity(
      promotion.buyMinQuantity != null ? String(promotion.buyMinQuantity) : "2",
    );
    setApplyToQuantity(
      promotion.applyToQuantity != null ? String(promotion.applyToQuantity) : "1",
    );
    setCampaignBudgetType(promotion.campaignBudgetType ?? "none");
    setCampaignBudgetLimit(
      promotion.campaignBudgetLimit != null ? String(promotion.campaignBudgetLimit) : "",
    );
  }, [promotion, open]);

  const isDirty = useMemo(() => {
    if (!promotion || !open) return false;
    const sameIds = (a: string[], b: string[]) =>
      a.length === b.length && a.every((id, i) => id === b[i]);
    return (
      code !== promotion.code ||
      status !== promotion.status ||
      isAutomatic !== promotion.isAutomatic ||
      isTaxInclusive !== promotion.isTaxInclusive ||
      (canEditValue && value !== String(promotion.value)) ||
      startsAt !== (promotion.startsAt ? toLocalInput(promotion.startsAt) : "") ||
      endsAt !== (promotion.endsAt ? toLocalInput(promotion.endsAt) : "") ||
      campaignName !== (promotion.campaignName ?? "") ||
      usageLimit !== (promotion.usageLimit != null ? String(promotion.usageLimit) : "") ||
      maxQuantity !== (promotion.maxQuantity != null ? String(promotion.maxQuantity) : "") ||
      campaignBudgetType !== (promotion.campaignBudgetType ?? "none") ||
      campaignBudgetLimit !==
        (promotion.campaignBudgetLimit != null ? String(promotion.campaignBudgetLimit) : "") ||
      (needsProducts && !sameIds(productIds, promotion.productIds ?? [])) ||
      (isBuyGet &&
        (buyMinQuantity !==
          (promotion.buyMinQuantity != null ? String(promotion.buyMinQuantity) : "2") ||
          applyToQuantity !==
            (promotion.applyToQuantity != null ? String(promotion.applyToQuantity) : "1") ||
          !sameIds(buyProductIds, promotion.buyProductIds ?? [])))
    );
  }, [
    promotion,
    open,
    code,
    status,
    isAutomatic,
    isTaxInclusive,
    canEditValue,
    value,
    startsAt,
    endsAt,
    campaignName,
    usageLimit,
    maxQuantity,
    campaignBudgetType,
    campaignBudgetLimit,
    needsProducts,
    productIds,
    isBuyGet,
    buyMinQuantity,
    applyToQuantity,
    buyProductIds,
  ]);

  const { leaveDialogOpen, requestLeave, confirmLeave, cancelLeave } =
    useUnsavedChangesGuard(isDirty);

  function requestClose() {
    requestLeave(() => onOpenChange(false));
  }

  useEffect(() => {
    if (!open || !needsProducts) return;
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
  }, [open, needsProducts]);

  async function save() {
    if (!promotion) return;
    const nextCode = code.trim().toUpperCase().replace(/\s+/g, "");
    if (nextCode.length < 2) {
      toast.error(t("promotions.edit.codeTooShort"));
      return;
    }
    const nextValue = canEditValue ? Number(value) : promotion.value;
    if (canEditValue && (!Number.isFinite(nextValue) || nextValue <= 0)) {
      toast.error(t("promotions.edit.invalidValue"));
      return;
    }
    const nextUsageLimit = usageLimit.trim() ? Number(usageLimit) : null;
    if (usageLimit.trim() && (!Number.isFinite(nextUsageLimit) || (nextUsageLimit ?? 0) <= 0)) {
      toast.error(t("promotions.edit.invalidUsageLimit"));
      return;
    }
    const nextMaxQuantity = maxQuantity.trim() ? Number(maxQuantity) : null;
    if (maxQuantity.trim() && (!Number.isFinite(nextMaxQuantity) || (nextMaxQuantity ?? 0) <= 0)) {
      toast.error(t("promotions.edit.invalidMaxQty"));
      return;
    }
    const nextBudgetLimit =
      campaignBudgetType !== "none" && campaignBudgetLimit.trim()
        ? Number(campaignBudgetLimit)
        : null;
    if (
      campaignBudgetType !== "none" &&
      (!Number.isFinite(nextBudgetLimit) || (nextBudgetLimit ?? 0) <= 0)
    ) {
      toast.error(t("promotions.edit.invalidBudget"));
      return;
    }

    setSaving(true);
    const response = await fetch(`/admin/promotions/actions/${encodeURIComponent(promotion.id)}`, {
      body: JSON.stringify({
        allocation: showAllocation ? allocation : null,
        applyToQuantity: isBuyGet ? Number(applyToQuantity) || null : promotion.applyToQuantity,
        buyMinQuantity: isBuyGet ? Number(buyMinQuantity) || null : promotion.buyMinQuantity,
        buyProductIds: isBuyGet ? buyProductIds : promotion.buyProductIds,
        campaignBudgetLimit: nextBudgetLimit,
        campaignBudgetType: campaignBudgetType === "none" ? null : campaignBudgetType,
        campaignName: campaignName.trim() || null,
        code: nextCode,
        currencyCode: promotion.currencyCode,
        endsAt: endsAt ? new Date(endsAt).toISOString() : null,
        isAutomatic,
        isTaxInclusive,
        maxQuantity:
          nextMaxQuantity ??
          (showAllocation && allocation === "each" ? 1 : null),
        method: promotion.method,
        productIds: needsProducts ? productIds : promotion.productIds,
        promotionType: promotion.promotionType,
        startsAt: startsAt ? new Date(startsAt).toISOString() : null,
        status,
        targetType: promotion.targetType,
        usageLimit: nextUsageLimit,
        value: nextValue,
      }),
      headers: {
        accept: "application/json",
        "content-type": "application/json",
      },
      method: "POST",
    }).catch(() => null);
    setSaving(false);

    if (!response?.ok) {
      toast.error(
        await readPlatformErrorMessage(response, {
          fallback: t("promotions.edit.updateFailed"),
          resource: "Promotion",
        }),
      );
      return;
    }
    toast.success(t("promotions.edit.updated"));
    onOpenChange(false);
    router.refresh();
  }

  return (
    <>
    <Sheet
      onOpenChange={(next) => {
        if (!next) requestClose();
        else onOpenChange(true);
      }}
      open={open}
    >
      <SheetContent className="w-full sm:max-w-lg" side="right">
        <SheetHeader className="px-5 py-4 text-left">
          <SheetTitle>{t("promotions.edit.title")}</SheetTitle>
          <SheetDescription>
            {promotion ? offerSummary(promotion, t) : t("promotions.edit.fallbackDesc")}
          </SheetDescription>
        </SheetHeader>

        <SheetBody className="grid content-start gap-5 px-5 py-5">
          <Field>
            <FieldLabel htmlFor="promo-edit-code">{t("promotions.edit.codeLabel")}</FieldLabel>
            <Input
              id="promo-edit-code"
              onChange={(event) => setCode(event.target.value.toUpperCase().replace(/\s+/g, ""))}
              value={code}
            />
          </Field>

          <Field>
            <FieldLabel>{t("promotions.edit.status")}</FieldLabel>
            <Select
              onValueChange={(next: MerchantPromotion["status"]) => setStatus(next)}
              value={status}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="active">{t("promotions.edit.statusActive")}</SelectItem>
                  <SelectItem value="draft">{t("promotions.edit.statusDraft")}</SelectItem>
                  <SelectItem value="inactive">{t("promotions.edit.statusInactive")}</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>

          {canEditValue ? (
            <Field>
              <FieldLabel htmlFor="promo-edit-value">
                {promotion?.method === "percentage" ? t("promotions.edit.percentOff") : t("promotions.edit.amountOff")}
              </FieldLabel>
              <Input
                id="promo-edit-value"
                min="0.01"
                onChange={(event) => setValue(event.target.value)}
                step="0.01"
                type="number"
                value={value}
              />
            </Field>
          ) : (
            <div className="rounded-2xl border border-border/80 bg-muted/15 px-3.5 py-3">
              <p className="text-sm font-medium">{t("promotions.edit.discount")}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {promotion ? offerSummary(promotion, t) : "—"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {t("promotions.edit.fixedShapeHelp")}
              </p>
            </div>
          )}

          <Field>
            <FieldLabel htmlFor="promo-edit-usage">{t("promotions.edit.usageLimit")}</FieldLabel>
            <Input
              id="promo-edit-usage"
              min="1"
              onChange={(event) => setUsageLimit(event.target.value)}
              placeholder={t("promotions.edit.unlimited")}
              type="number"
              value={usageLimit}
            />
            <FieldDescription>
              {t("promotions.edit.usageLimitHelp")}
            </FieldDescription>
          </Field>

          {needsProducts ? (
            <div className="space-y-3 rounded-2xl border border-border/80 bg-card p-4 shadow-[0_1px_2px_color-mix(in_oklch,var(--foreground)_4%,transparent)]">
              <div>
                <p className="text-sm font-medium tracking-tight">
                  {isBuyGet ? t("promotions.edit.productsCountToward") : t("promotions.edit.eligibleProducts")}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {t("promotions.edit.productsHelp")}
                </p>
              </div>
              <ProductMultiPicker
                catalog={catalog}
                loading={catalogLoading}
                onChange={setProductIds}
                selectedIds={productIds}
              />
              {showAllocation ? (
                <Field>
                  <FieldLabel>{t("promotions.edit.allocation")}</FieldLabel>
                  <Select
                    onValueChange={(next: "each" | "across") => setAllocation(next)}
                    value={allocation}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="each">{t("promotions.edit.allocEach")}</SelectItem>
                        <SelectItem value="across">{t("promotions.edit.allocAcross")}</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
              ) : null}
              {showAllocation ? (
                <Field>
                  <FieldLabel htmlFor="promo-edit-max-qty">{t("promotions.edit.maxDiscountedQty")}</FieldLabel>
                  <Input
                    id="promo-edit-max-qty"
                    min="1"
                    onChange={(event) => setMaxQuantity(event.target.value)}
                    placeholder={t("promotions.edit.noMax")}
                    type="number"
                    value={maxQuantity}
                  />
                </Field>
              ) : null}
              {isBuyGet ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="promo-edit-buy-x">{t("promotions.edit.buyQty")}</FieldLabel>
                    <Input
                      id="promo-edit-buy-x"
                      min="1"
                      onChange={(event) => setBuyMinQuantity(event.target.value)}
                      type="number"
                      value={buyMinQuantity}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="promo-edit-get-y">{t("promotions.edit.getQty")}</FieldLabel>
                    <Input
                      id="promo-edit-get-y"
                      min="1"
                      onChange={(event) => setApplyToQuantity(event.target.value)}
                      type="number"
                      value={applyToQuantity}
                    />
                  </Field>
                  <div className="space-y-2 sm:col-span-2">
                    <p className="text-sm font-medium">{t("promotions.edit.freeProducts")}</p>
                    <p className="text-xs text-muted-foreground">
                      {t("promotions.edit.freeProductsHelp")}
                    </p>
                    <ProductMultiPicker
                      catalog={catalog}
                      loading={catalogLoading}
                      onChange={setBuyProductIds}
                      selectedIds={buyProductIds}
                    />
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          <Field className="flex flex-row items-center justify-between gap-4 rounded-2xl border border-border/80 bg-card px-3.5 py-3 shadow-[0_1px_2px_color-mix(in_oklch,var(--foreground)_4%,transparent)]">
            <div className="min-w-0 space-y-1">
              <FieldLabel className="text-sm" htmlFor="promo-edit-automatic">
                {t("promotions.edit.autoLabel")}
              </FieldLabel>
              <FieldDescription className="text-xs">
                {t("promotions.edit.autoDesc")}
              </FieldDescription>
            </div>
            <Switch
              checked={isAutomatic}
              id="promo-edit-automatic"
              onCheckedChange={setIsAutomatic}
            />
          </Field>

          {!isBuyGet && !isFreeShipping ? (
            <Field className="flex flex-row items-center justify-between gap-4 rounded-2xl border border-border/80 bg-card px-3.5 py-3 shadow-[0_1px_2px_color-mix(in_oklch,var(--foreground)_4%,transparent)]">
              <div className="min-w-0 space-y-1">
                <FieldLabel className="text-sm" htmlFor="promo-edit-tax">
                  {t("promotions.edit.taxLabel")}
                </FieldLabel>
                <FieldDescription className="text-xs">
                  {t("promotions.edit.taxDesc")}
                </FieldDescription>
              </div>
              <Switch
                checked={isTaxInclusive}
                id="promo-edit-tax"
                onCheckedChange={setIsTaxInclusive}
              />
            </Field>
          ) : null}

          <div className="space-y-4 rounded-2xl border border-border/80 bg-card p-4 shadow-[0_1px_2px_color-mix(in_oklch,var(--foreground)_4%,transparent)]">
            <div>
              <p className="text-sm font-medium tracking-tight">{t("promotions.edit.schedule")}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {t("promotions.edit.scheduleHelp")}
              </p>
            </div>
            <Field>
              <FieldLabel htmlFor="promo-edit-campaign">{t("promotions.edit.campaignName")}</FieldLabel>
              <Input
                id="promo-edit-campaign"
                onChange={(event) => setCampaignName(event.target.value)}
                placeholder={code || t("promotions.edit.campaignPlaceholder")}
                value={campaignName}
              />
            </Field>
            <Field>
              <FieldLabel>{t("promotions.edit.starts")}</FieldLabel>
              <DateTimePicker
                onChange={setStartsAt}
                placeholder={t("promotions.edit.optionalStart")}
                value={startsAt}
              />
            </Field>
            <Field>
              <FieldLabel>{t("promotions.edit.ends")}</FieldLabel>
              <DateTimePicker onChange={setEndsAt} placeholder={t("promotions.edit.optionalEnd")} value={endsAt} />
            </Field>
            <Field>
              <FieldLabel>{t("promotions.edit.campaignBudget")}</FieldLabel>
              <Select
                onValueChange={(next: "none" | "usage" | "spend") => setCampaignBudgetType(next)}
                value={campaignBudgetType}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="none">{t("promotions.edit.budgetNone")}</SelectItem>
                    <SelectItem value="usage">{t("promotions.edit.budgetUsage")}</SelectItem>
                    <SelectItem value="spend">{t("promotions.edit.budgetSpend")}</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            {campaignBudgetType !== "none" ? (
              <Field>
                <FieldLabel htmlFor="promo-edit-budget">
                  {campaignBudgetType === "usage" ? t("promotions.edit.maxUses") : t("promotions.edit.maxSpend")}
                </FieldLabel>
                <Input
                  id="promo-edit-budget"
                  min="1"
                  onChange={(event) => setCampaignBudgetLimit(event.target.value)}
                  type="number"
                  value={campaignBudgetLimit}
                />
              </Field>
            ) : null}
          </div>

          {promotion ? (
            <p className="text-xs text-muted-foreground">
              {promotion.usageLimit != null
                ? t("promotions.edit.usedOfLimit", {
                    count: promotion.usageCount,
                    limit: promotion.usageLimit,
                  })
                : t("promotions.edit.usedCount", { count: promotion.usageCount })}
            </p>
          ) : null}
        </SheetBody>

        <SheetFooter className="flex-row justify-end gap-2 px-5 py-4">
          <Button onClick={requestClose} type="button" variant="outline">
            {t("common.cancel")}
          </Button>
          <Button disabled={saving || !promotion} onClick={() => void save()} type="button">
            {saving ? t("promotions.edit.saving") : t("promotions.edit.saveChanges")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
    <UnsavedChangesDialog
      onLeave={confirmLeave}
      onStay={cancelLeave}
      open={leaveDialogOpen}
    />
    </>
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
        searchPlaceholder={t("promotions.edit.searchProducts")}
        selectedIds={selectedIds}
        selectionMode="multiple"
        title={t("promotions.edit.eligibleProducts")}
      />
    </>
  );
}

/** Convert ISO strings to the datetime-local style value our picker accepts. */
function toLocalInput(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
