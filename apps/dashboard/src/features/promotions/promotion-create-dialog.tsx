"use client";

import { useRouter } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

type OfferKind =
  | "percentage_order"
  | "fixed_order"
  | "percentage_items"
  | "fixed_items"
  | "buyget"
  | "free_shipping";

type CatalogProduct = { id: string; title: string | null; handle: string | null };

const offerOptions: {
  description: string;
  id: OfferKind;
  title: string;
}[] = [
  {
    id: "percentage_order",
    title: "Percentage off order",
    description: "Take a percent off the customer’s full order total.",
  },
  {
    id: "fixed_order",
    title: "Amount off order",
    description: "Subtract a fixed amount from the order total.",
  },
  {
    id: "percentage_items",
    title: "Percentage off products",
    description: "Discount matching products by a percentage.",
  },
  {
    id: "fixed_items",
    title: "Amount off products",
    description: "Discount matching products by a fixed amount.",
  },
  {
    id: "buyget",
    title: "Buy X get Y",
    description: "When shoppers buy enough items, they get others free.",
  },
  {
    id: "free_shipping",
    title: "Free shipping",
    description: "Remove shipping cost on eligible orders.",
  },
];

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
          Create promotion
        </Button>
      }
    >
      <PromotionCreateDialogInner />
    </Suspense>
  );
}

function PromotionCreateDialogInner() {
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
        maxQuantity: form.maxQuantity ? Number(form.maxQuantity) : null,
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
      toast.error("Promotion could not be created.");
      return;
    }
    toast.success("Promotion created.");
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
          Create promotion
        </Button>
      </DialogTrigger>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="gap-1.5 border-b px-4 py-4 text-left sm:px-5">
          <DialogTitle>Create promotion</DialogTitle>
          <DialogDescription>
            Set the offer type, configure how it applies, then choose a schedule and budget.
          </DialogDescription>
          <ol className="mt-3 flex flex-wrap gap-2 text-xs">
            {["Type", "Details", "Schedule"].map((label, index) => (
              <li
                className={cn(
                  "rounded-full px-2.5 py-1 font-medium",
                  step === index
                    ? "bg-primary text-primary-foreground"
                    : step > index
                      ? "bg-primary/15 text-primary"
                      : "bg-muted text-muted-foreground",
                )}
                key={label}
              >
                {index + 1}. {label}
              </li>
            ))}
          </ol>
        </DialogHeader>

        <div className="max-h-[min(70dvh,36rem)] overflow-y-auto p-4 sm:p-5">
          {step === 0 ? (
            <div className="grid gap-2">
              {offerOptions.map((option) => {
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
                  <p className="text-sm font-medium">Basics</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Code, status, and whether shoppers must enter the code at checkout.
                  </p>
                </div>
                <Field className="sm:col-span-2">
                  <FieldLabel>Promotion code</FieldLabel>
                  <Input
                    onChange={(event) =>
                      setForm({ ...form, code: event.target.value.toUpperCase().replace(/\s+/g, "") })
                    }
                    placeholder="WELCOME10"
                    required
                    value={form.code}
                  />
                  <FieldDescription>
                    Use letters and numbers without spaces. Shoppers enter this unless automatic
                    apply is on.
                  </FieldDescription>
                </Field>
                <Field>
                  <FieldLabel>Status</FieldLabel>
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
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel>Usage limit</FieldLabel>
                  <Input
                    min="1"
                    onChange={(event) => setForm({ ...form, usageLimit: event.target.value })}
                    placeholder="Unlimited"
                    type="number"
                    value={form.usageLimit}
                  />
                  <FieldDescription>Total redemptions across all orders.</FieldDescription>
                </Field>
                <Field className="flex flex-row items-center justify-between gap-4 rounded-xl border px-3.5 py-3 sm:col-span-2">
                  <div className="min-w-0 space-y-1">
                    <FieldLabel className="text-sm" htmlFor="promo-automatic">
                      Apply automatically
                    </FieldLabel>
                    <FieldDescription className="text-xs">
                      Eligible carts get the discount without entering a code.
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
                        Apply after tax
                      </FieldLabel>
                      <FieldDescription className="text-xs">
                        When off, the discount is calculated on the cart before tax.
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
                    <p className="text-sm font-medium">Discount value</p>
                  </div>
                  <Field>
                    <FieldLabel>
                      {derived.method === "percentage" ? "Percent off" : "Amount off (ETB)"}
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
                        <FieldLabel>Max quantity per item</FieldLabel>
                        <Input
                          min="1"
                          onChange={(event) => setForm({ ...form, maxQuantity: event.target.value })}
                          placeholder="No max"
                          type="number"
                          value={form.maxQuantity}
                        />
                        <FieldDescription>
                          Limit how many units of each matching item can be discounted.
                        </FieldDescription>
                      </Field>
                      <Field>
                        <FieldLabel>Allocation</FieldLabel>
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
                              <SelectItem value="each">Each item</SelectItem>
                              <SelectItem value="across">Across items</SelectItem>
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                        <FieldDescription>
                          Each applies the full discount per item; across splits it.
                        </FieldDescription>
                      </Field>
                    </>
                  ) : null}
                </section>
              ) : null}

              {form.offerKind === "buyget" ? (
                <section className="grid gap-4 border-t pt-5 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <p className="text-sm font-medium">Buy X get Y</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Set how many items unlock the offer, and how many free items shoppers receive.
                    </p>
                  </div>
                  <Field>
                    <FieldLabel>Buy quantity (X)</FieldLabel>
                    <Input
                      min="1"
                      onChange={(event) => setForm({ ...form, buyMinQuantity: event.target.value })}
                      type="number"
                      value={form.buyMinQuantity}
                    />
                  </Field>
                  <Field>
                    <FieldLabel>Get quantity (Y)</FieldLabel>
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
                        ? "Products that count toward the offer"
                        : "Products the discount applies to"}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Leave empty to apply more broadly once other conditions are added later.
                      {form.offerKind === "buyget"
                        ? " For Buy X get Y, select at least the products that unlock free items."
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
                      <p className="text-sm font-medium">Free products (optional)</p>
                      <p className="text-xs text-muted-foreground">
                        Defaults to the same products as above if left empty.
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
                  <p className="text-sm font-medium">Schedule</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Optional start and end times for when this offer is available.
                  </p>
                </div>
                <Field className="sm:col-span-2">
                  <FieldLabel>Campaign name</FieldLabel>
                  <Input
                    onChange={(event) => setForm({ ...form, campaignName: event.target.value })}
                    placeholder={form.code || "Summer sale"}
                    value={form.campaignName}
                  />
                  <FieldDescription>
                    A friendly name for reporting. Defaults to the promotion code.
                  </FieldDescription>
                </Field>
                <Field>
                  <FieldLabel>Starts</FieldLabel>
                  <DateTimePicker
                    onChange={(startsAt) => setForm({ ...form, startsAt })}
                    placeholder="Optional start"
                    value={form.startsAt}
                  />
                </Field>
                <Field>
                  <FieldLabel>Ends</FieldLabel>
                  <DateTimePicker
                    onChange={(endsAt) => setForm({ ...form, endsAt })}
                    placeholder="Optional end"
                    value={form.endsAt}
                  />
                </Field>
              </section>

              <section className="grid gap-4 border-t pt-5 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <p className="text-sm font-medium">Budget</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Cap how often the campaign can be used, or how much total discount it can give.
                  </p>
                </div>
                <Field>
                  <FieldLabel>Budget type</FieldLabel>
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
                        <SelectItem value="none">No budget cap</SelectItem>
                        <SelectItem value="usage">Usage count</SelectItem>
                        <SelectItem
                          disabled={form.offerKind === "buyget" || form.offerKind === "free_shipping"}
                          value="spend"
                        >
                          Total discounted amount
                        </SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
                {form.campaignBudgetType !== "none" ? (
                  <Field>
                    <FieldLabel>
                      {form.campaignBudgetType === "usage" ? "Max uses" : "Max spend (ETB)"}
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
        </div>

        <DialogFooter className="mx-0 mb-0 rounded-none border-t bg-muted/50 p-4">
          {step > 0 ? (
            <Button onClick={() => setStep((value) => value - 1)} type="button" variant="outline">
              Back
            </Button>
          ) : (
            <Button onClick={() => setOpen(false)} type="button" variant="outline">
              Cancel
            </Button>
          )}
          {step < 2 ? (
            <Button
              disabled={step === 1 && !canContinueFromDetails()}
              onClick={() => setStep((value) => value + 1)}
              type="button"
            >
              Continue
            </Button>
          ) : (
            <Button
              disabled={saving || !canContinueFromDetails()}
              onClick={() => void create()}
              type="button"
            >
              {saving ? "Creating…" : "Create promotion"}
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
        className="w-[var(--radix-popover-trigger-width)] overflow-hidden p-0"
        collisionPadding={16}
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <Command className="h-auto max-h-72 w-full">
          <CommandInput placeholder="Search products…" />
          <CommandList
            className="max-h-60 overflow-y-auto overscroll-contain"
            onWheel={(event) => event.stopPropagation()}
          >
            <CommandEmpty>No matching products.</CommandEmpty>
            <CommandGroup className="overflow-visible">
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
