"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { AppIcons } from "@/components/app/icons";
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
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import type { MerchantPromotion } from "@/lib/merchant-promotions";
import { cn } from "@/lib/utils";

type CatalogProduct = { id: string; title: string | null; handle: string | null };

function offerSummary(promotion: MerchantPromotion) {
  if (promotion.promotionType === "buyget") {
    return `Buy ${promotion.buyMinQuantity ?? "X"} get ${promotion.applyToQuantity ?? "Y"}`;
  }
  if (
    promotion.targetType === "shipping_methods" &&
    promotion.method === "percentage" &&
    promotion.value >= 100
  ) {
    return "Free shipping";
  }
  const amount =
    promotion.method === "percentage"
      ? `${promotion.value}% off`
      : `${promotion.value} ${promotion.currencyCode?.toUpperCase() ?? "ETB"} off`;
  const target =
    promotion.targetType === "items"
      ? "products"
      : promotion.targetType === "shipping_methods"
        ? "shipping"
        : "order";
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
      toast.error("Enter a promotion code with at least 2 characters.");
      return;
    }
    const nextValue = canEditValue ? Number(value) : promotion.value;
    if (canEditValue && (!Number.isFinite(nextValue) || nextValue <= 0)) {
      toast.error("Enter a valid discount value.");
      return;
    }
    const nextUsageLimit = usageLimit.trim() ? Number(usageLimit) : null;
    if (usageLimit.trim() && (!Number.isFinite(nextUsageLimit) || (nextUsageLimit ?? 0) <= 0)) {
      toast.error("Usage limit must be a positive number.");
      return;
    }
    const nextMaxQuantity = maxQuantity.trim() ? Number(maxQuantity) : null;
    if (maxQuantity.trim() && (!Number.isFinite(nextMaxQuantity) || (nextMaxQuantity ?? 0) <= 0)) {
      toast.error("Max quantity must be a positive number.");
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
      toast.error("Enter a valid campaign budget limit.");
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
      toast.error("Promotion could not be updated.");
      return;
    }
    toast.success("Promotion updated.");
    onOpenChange(false);
    router.refresh();
  }

  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-lg" side="right">
        <SheetHeader className="border-b px-5 py-4 pr-12 text-left">
          <SheetTitle>Edit promotion</SheetTitle>
          <SheetDescription>
            {promotion ? offerSummary(promotion) : "Update code, status, products, and schedule."}
          </SheetDescription>
        </SheetHeader>

        <div className="grid flex-1 content-start gap-5 overflow-y-auto px-5 py-5">
          <Field>
            <FieldLabel htmlFor="promo-edit-code">Promotion code</FieldLabel>
            <Input
              id="promo-edit-code"
              onChange={(event) => setCode(event.target.value.toUpperCase().replace(/\s+/g, ""))}
              value={code}
            />
          </Field>

          <Field>
            <FieldLabel>Status</FieldLabel>
            <Select
              onValueChange={(next: MerchantPromotion["status"]) => setStatus(next)}
              value={status}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>

          {canEditValue ? (
            <Field>
              <FieldLabel htmlFor="promo-edit-value">
                {promotion?.method === "percentage" ? "Percent off" : "Amount off (ETB)"}
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
              <p className="text-sm font-medium">Discount</p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {promotion ? offerSummary(promotion) : "—"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                This offer type keeps a fixed discount shape after creation.
              </p>
            </div>
          )}

          <Field>
            <FieldLabel htmlFor="promo-edit-usage">Usage limit</FieldLabel>
            <Input
              id="promo-edit-usage"
              min="1"
              onChange={(event) => setUsageLimit(event.target.value)}
              placeholder="Unlimited"
              type="number"
              value={usageLimit}
            />
            <FieldDescription>
              Total times this promotion can be redeemed. Leave empty for no limit.
            </FieldDescription>
          </Field>

          {needsProducts ? (
            <div className="space-y-3 rounded-xl border p-4">
              <div>
                <p className="text-sm font-medium">
                  {isBuyGet ? "Products that count toward the offer" : "Eligible products"}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Choose which catalog products this promotion targets.
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
                  <FieldLabel>Allocation</FieldLabel>
                  <Select
                    onValueChange={(next: "each" | "across") => setAllocation(next)}
                    value={allocation}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="each">Each item</SelectItem>
                        <SelectItem value="across">Across items</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
              ) : null}
              {showAllocation ? (
                <Field>
                  <FieldLabel htmlFor="promo-edit-max-qty">Max discounted quantity</FieldLabel>
                  <Input
                    id="promo-edit-max-qty"
                    min="1"
                    onChange={(event) => setMaxQuantity(event.target.value)}
                    placeholder="No max"
                    type="number"
                    value={maxQuantity}
                  />
                </Field>
              ) : null}
              {isBuyGet ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="promo-edit-buy-x">Buy quantity (X)</FieldLabel>
                    <Input
                      id="promo-edit-buy-x"
                      min="1"
                      onChange={(event) => setBuyMinQuantity(event.target.value)}
                      type="number"
                      value={buyMinQuantity}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="promo-edit-get-y">Get quantity (Y)</FieldLabel>
                    <Input
                      id="promo-edit-get-y"
                      min="1"
                      onChange={(event) => setApplyToQuantity(event.target.value)}
                      type="number"
                      value={applyToQuantity}
                    />
                  </Field>
                  <div className="space-y-2 sm:col-span-2">
                    <p className="text-sm font-medium">Free products (optional)</p>
                    <p className="text-xs text-muted-foreground">
                      Defaults to the same products as above if left empty.
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
                Apply automatically
              </FieldLabel>
              <FieldDescription className="text-xs">
                Eligible carts get the discount without entering a code.
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
                  Apply after tax
                </FieldLabel>
                <FieldDescription className="text-xs">
                  When off, the discount is calculated before tax.
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
              <p className="text-sm font-medium">Schedule</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Optional start and end times for when this offer is available.
              </p>
            </div>
            <Field>
              <FieldLabel htmlFor="promo-edit-campaign">Campaign name</FieldLabel>
              <Input
                id="promo-edit-campaign"
                onChange={(event) => setCampaignName(event.target.value)}
                placeholder={code || "Campaign"}
                value={campaignName}
              />
            </Field>
            <Field>
              <FieldLabel>Starts</FieldLabel>
              <DateTimePicker
                onChange={setStartsAt}
                placeholder="Optional start"
                value={startsAt}
              />
            </Field>
            <Field>
              <FieldLabel>Ends</FieldLabel>
              <DateTimePicker onChange={setEndsAt} placeholder="Optional end" value={endsAt} />
            </Field>
            <Field>
              <FieldLabel>Campaign budget</FieldLabel>
              <Select
                onValueChange={(next: "none" | "usage" | "spend") => setCampaignBudgetType(next)}
                value={campaignBudgetType}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="none">No budget cap</SelectItem>
                    <SelectItem value="usage">Limit by redemptions</SelectItem>
                    <SelectItem value="spend">Limit by spend</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            {campaignBudgetType !== "none" ? (
              <Field>
                <FieldLabel htmlFor="promo-edit-budget">
                  {campaignBudgetType === "usage" ? "Max uses" : "Max spend (ETB)"}
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
              Used {promotion.usageCount}
              {promotion.usageLimit != null ? ` of ${promotion.usageLimit}` : ""} time
              {promotion.usageCount === 1 ? "" : "s"}.
            </p>
          ) : null}
        </div>

        <SheetFooter className="flex-row justify-end gap-2 border-t bg-muted/30 px-5 py-4">
          <Button onClick={() => onOpenChange(false)} type="button" variant="outline">
            Cancel
          </Button>
          <Button disabled={saving || !promotion} onClick={() => void save()} type="button">
            {saving ? "Saving…" : "Save changes"}
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
  const [open, setOpen] = useState(false);
  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);

  function toggle(id: string) {
    if (selected.has(id)) onChange(selectedIds.filter((item) => item !== id));
    else onChange([...selectedIds, id]);
  }

  const label =
    selectedIds.length === 0
      ? loading
        ? "Loading products…"
        : "Select products…"
      : selectedIds.length === 1
        ? "1 product selected"
        : `${selectedIds.length} products selected`;

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger asChild>
        <Button
          className={cn(
            "h-8 w-full justify-between px-2.5 font-normal shadow-none",
            selectedIds.length === 0 && "text-muted-foreground",
          )}
          role="combobox"
          type="button"
          variant="outline"
        >
          <span className="truncate">{label}</span>
          <AppIcons.arrowDown className="size-4 shrink-0 opacity-60" data-icon="inline-end" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[var(--radix-popover-trigger-width)] p-0"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <Command>
          <CommandInput placeholder="Search products…" />
          <CommandList className="max-h-52">
            <CommandEmpty>No matching products.</CommandEmpty>
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
