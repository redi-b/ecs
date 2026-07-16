"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { AppIcons } from "@/components/app/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { DateTimePicker } from "@/components/ui/datetime-picker";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
import type { MessageKey } from "@/i18n/messages";
import { useI18n } from "@/i18n/provider";
import type { MerchantPromotion } from "@/lib/merchant-promotions";
import { cn } from "@/lib/utils";

type Translate = (key: MessageKey, values?: Record<string, string | number | Date>) => string;

type CatalogProduct = { id: string; title: string | null; handle: string | null };

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

  useEffect(() => {
    if (!open || !needsProducts) return;
    setCatalogLoading(true);
    void fetch("/admin/products/actions/list?limit=100", {
      headers: { accept: "application/json" },
    })
      .then(async (response) => {
        const data = (await response.json().catch(() => ({}))) as {
          products?: Array<{ id: string; title?: string | null; handle?: string | null }>;
        };
        setCatalog(
          response.ok && Array.isArray(data.products)
            ? data.products.map((product) => ({
                id: product.id,
                title: product.title ?? null,
                handle: product.handle ?? null,
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
        maxQuantity: nextMaxQuantity,
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
      toast.error(t("promotions.edit.updateFailed"));
      return;
    }
    toast.success(t("promotions.edit.updated"));
    onOpenChange(false);
    router.refresh();
  }

  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
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
            <div className="rounded-xl border px-3.5 py-3">
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
            <div className="space-y-3 rounded-xl border p-4">
              <div>
                <p className="text-sm font-medium">
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

          <Field className="flex flex-row items-center justify-between gap-4 rounded-xl border px-3.5 py-3">
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
            <Field className="flex flex-row items-center justify-between gap-4 rounded-xl border px-3.5 py-3">
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

          <div className="space-y-4 rounded-xl border p-4">
            <div>
              <p className="text-sm font-medium">{t("promotions.edit.schedule")}</p>
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
          <Button onClick={() => onOpenChange(false)} type="button" variant="outline">
            {t("common.cancel")}
          </Button>
          <Button disabled={saving || !promotion} onClick={() => void save()} type="button">
            {saving ? t("promotions.edit.saving") : t("promotions.edit.saveChanges")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
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
  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedProducts = useMemo(
    () =>
      selectedIds
        .map((id) => catalog.find((product) => product.id === id))
        .filter((product): product is CatalogProduct => Boolean(product)),
    [catalog, selectedIds],
  );

  function toggle(id: string) {
    if (selected.has(id)) onChange(selectedIds.filter((item) => item !== id));
    else onChange([...selectedIds, id]);
  }

  function remove(id: string, event: { preventDefault: () => void; stopPropagation: () => void }) {
    event.preventDefault();
    event.stopPropagation();
    onChange(selectedIds.filter((item) => item !== id));
  }

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger asChild>
        <Button
          className={cn(
            "h-auto min-h-8 w-full justify-between px-2.5 py-1.5 font-normal shadow-none",
            selectedIds.length === 0 && "text-muted-foreground",
          )}
          role="combobox"
          type="button"
          variant="outline"
        >
          <span className="flex min-w-0 flex-1 flex-wrap items-center gap-1 text-left">
            {selectedIds.length === 0 ? (
              <span className="truncate">
                {loading
                  ? t("promotions.edit.loadingProducts")
                  : t("promotions.edit.selectProducts")}
              </span>
            ) : (
              selectedProducts.map((product) => {
                const label = product.title ?? product.handle ?? product.id;
                return (
                  <Badge
                    className="max-w-[10rem] gap-1 rounded-md px-1.5 py-0 font-normal"
                    key={product.id}
                    variant="secondary"
                  >
                    <span className="truncate">{label}</span>
                    <button
                      aria-label={label}
                      className="rounded-sm opacity-60 hover:opacity-100"
                      onClick={(event) => remove(product.id, event)}
                      type="button"
                    >
                      <AppIcons.close className="size-3" />
                    </button>
                  </Badge>
                );
              })
            )}
          </span>
          <AppIcons.arrowDown className="size-4 shrink-0 opacity-60" data-icon="inline-end" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-0">
        <Command>
          <CommandInput autoFocus placeholder={t("promotions.edit.searchProducts")} />
          <CommandList className="max-h-52">
            <CommandEmpty>{t("promotions.edit.noMatchingProducts")}</CommandEmpty>
            <CommandGroup>
              {catalog.map((product) => {
                const isSelected = selected.has(product.id);
                return (
                  <CommandItem
                    data-checked={isSelected ? true : undefined}
                    key={product.id}
                    onSelect={() => toggle(product.id)}
                    value={`${product.title ?? ""} ${product.handle ?? ""} ${product.id}`}
                  >
                    <Checkbox checked={isSelected} tabIndex={-1} />
                    <span className="min-w-0 flex-1 truncate">
                      {product.title ?? product.handle ?? product.id}
                    </span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/** Convert ISO strings to the datetime-local style value our picker accepts. */
function toLocalInput(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
