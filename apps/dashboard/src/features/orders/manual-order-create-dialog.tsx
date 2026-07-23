"use client";

import { useRouter } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import Link from "@/components/app/link";
import { AppIcons } from "@/components/app/icons";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
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
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  ProductCatalogPickerDialog,
  ProductCatalogPickerTrigger,
  type ProductCatalogPickProduct,
} from "@/features/products/product-catalog-picker-dialog";
import { useI18n } from "@/i18n/provider";
import { mapPlatformErrorMessage } from "@/lib/platform-api/errors";
import { dashboardRoutes } from "@/lib/routes";
import { useCreateQueryOpen } from "@/lib/use-create-query-open";
import {
  DialogStepPanel,
  DialogStepRail,
  getDialogStepStatus,
} from "@/components/app/dialog-step-rail";
import { cn } from "@/lib/utils";

import {
  emptyAddress,
  formatPrice,
  type AddressForm,
  type CatalogVariant,
  type CustomerOption,
  type LineItem,
} from "./manual-order-model";
import { CreateOrderTriggerButton, CustomerPicker } from "./manual-order-parts";

export function ManualOrderCreateDialog() {
  return (
    <Suspense fallback={<CreateOrderTriggerButton disabled />}>
      <ManualOrderCreateDialogInner />
    </Suspense>
  );
}

function ManualOrderCreateDialogInner() {
  const { t } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useCreateQueryOpen({
    values: ["1", "true", "order"],
    onOpen: () => {
      setStep(0);
      setOpen(true);
    },
  });

  const [customerMode, setCustomerMode] = useState<"existing" | "new">("existing");
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerFirstName, setCustomerFirstName] = useState("");
  const [customerLastName, setCustomerLastName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");

  const [lines, setLines] = useState<LineItem[]>([]);
  const [note, setNote] = useState("");
  const [includeAddress, setIncludeAddress] = useState(true);
  const [address, setAddress] = useState<AddressForm>(emptyAddress);

  const [variants, setVariants] = useState<CatalogVariant[]>([]);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogLoadingMore, setCatalogLoadingMore] = useState(false);
  const [catalogOffset, setCatalogOffset] = useState(0);
  const [catalogHasMore, setCatalogHasMore] = useState(false);
  const [productPickerOpen, setProductPickerOpen] = useState(false);

  const CATALOG_PAGE = 40;

  async function loadProductCatalog(offset: number, append: boolean) {
    if (append) setCatalogLoadingMore(true);
    else setCatalogLoading(true);

    try {
      const response = await fetch(
        `/admin/products/actions/list?limit=${CATALOG_PAGE}&offset=${offset}`,
        { headers: { accept: "application/json" } },
      );
      const data = (await response.json().catch(() => ({}))) as {
        products?: Array<{
          id: string;
          title?: string | null;
          handle?: string | null;
          thumbnail?: string | null;
          variants?: Array<{
            id: string;
            prices?: Array<{ amount?: number | null; currencyCode?: string | null }>;
            sku?: string | null;
            title?: string | null;
            optionValues?: Array<{
              optionTitle?: string | null;
              value?: string | null;
            }>;
            stock?: {
              availableQuantity?: number | null;
              stockedQuantity?: number | null;
            } | null;
          }>;
        }>;
        count?: number;
      };

      if (!response.ok || !Array.isArray(data.products)) {
        if (!append) setVariants([]);
        setCatalogHasMore(false);
        return;
      }

      const nextVariants = data.products.flatMap((product) =>
        (product.variants ?? []).map((variant) => {
          const price = variant.prices?.[0];
          const priceLabel =
            price?.amount != null
              ? formatPrice(price.amount, price.currencyCode ?? "etb")
              : null;
          const productTitle = product.title ?? t("orders.create.productFallback");
          const variantTitle = variant.title ?? t("orders.create.defaultOption");
          const options: Record<string, string> = {};
          for (const option of variant.optionValues ?? []) {
            const title = option.optionTitle?.trim();
            const value = option.value?.trim();
            if (!title || !value || title === "Default") continue;
            options[title] = value;
          }
          const stock = variant.stock;
          const availableQuantity =
            stock == null
              ? null
              : typeof stock.availableQuantity === "number"
                ? stock.availableQuantity
                : typeof stock.stockedQuantity === "number"
                  ? stock.stockedQuantity
                  : null;
          return {
            id: variant.id,
            availableQuantity,
            label: [productTitle, variantTitle].filter(Boolean).join(" · "),
            options,
            priceLabel,
            productId: product.id,
            productTitle,
            sku: variant.sku ?? null,
            thumbnailUrl: product.thumbnail ?? null,
            variantTitle,
          } satisfies CatalogVariant;
        }),
      );

      setVariants((current) => (append ? [...current, ...nextVariants] : nextVariants));
      const total = typeof data.count === "number" ? data.count : offset + data.products.length;
      const nextOffset = offset + data.products.length;
      setCatalogOffset(nextOffset);
      setCatalogHasMore(nextOffset < total && data.products.length >= CATALOG_PAGE);
    } catch {
      if (!append) setVariants([]);
      setCatalogHasMore(false);
    } finally {
      setCatalogLoading(false);
      setCatalogLoadingMore(false);
    }
  }

  useEffect(() => {
    if (!open) return;

    setCatalogOffset(0);
    void loadProductCatalog(0, false);

    void fetch("/admin/customers/actions/list?limit=100", {
      headers: { accept: "application/json" },
    })
      .then(async (response) => {
        const data = (await response.json().catch(() => ({}))) as {
          customers?: Array<{
            email: string;
            firstName?: string | null;
            id: string;
            lastName?: string | null;
            phone?: string | null;
          }>;
        };
        if (!response.ok || !Array.isArray(data.customers)) return [] as CustomerOption[];
        return data.customers.map((customer) => {
          const name = [customer.firstName, customer.lastName].filter(Boolean).join(" ").trim();
          return {
            email: customer.email,
            firstName: customer.firstName ?? null,
            id: customer.id,
            label: name ? `${name} · ${customer.email}` : customer.email,
            lastName: customer.lastName ?? null,
            phone: customer.phone ?? null,
          };
        });
      })
      .catch(() => [] as CustomerOption[])
      .then((nextCustomers) => setCustomers(nextCustomers));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once when dialog opens
  }, [open]);

  const selectedCustomer = useMemo(
    () => customers.find((customer) => customer.id === customerId) ?? null,
    [customerId, customers],
  );

  const variantById = useMemo(
    () => new Map(variants.map((variant) => [variant.id, variant])),
    [variants],
  );

  const productPickerCatalog = useMemo<ProductCatalogPickProduct[]>(() => {
    const byProduct = new Map<
      string,
      ProductCatalogPickProduct & { variants: NonNullable<ProductCatalogPickProduct["variants"]> }
    >();
    for (const variant of variants) {
      let product = byProduct.get(variant.productId);
      if (!product) {
        product = {
          id: variant.productId,
          title: variant.productTitle,
          thumbnailUrl: variant.thumbnailUrl,
          searchText: [variant.productTitle, variant.productId].filter(Boolean).join(" "),
          variants: [],
        };
        byProduct.set(variant.productId, product);
      }
      product.variants.push({
        id: variant.id,
        title: variant.variantTitle,
        sku: variant.sku,
        priceLabel: variant.priceLabel,
        options: variant.options,
        availableQuantity: variant.availableQuantity,
      });
      product.searchText = [
        product.searchText,
        variant.variantTitle,
        variant.sku,
        variant.id,
        ...Object.values(variant.options),
      ]
        .filter(Boolean)
        .join(" ");
    }
    return [...byProduct.values()];
  }, [variants]);

  function reset() {
    setStep(0);
    setSaving(false);
    setError(null);
    setCustomerMode("existing");
    setCustomerId(null);
    setCustomerEmail("");
    setCustomerFirstName("");
    setCustomerLastName("");
    setCustomerPhone("");
    setLines([]);
    setNote("");
    setIncludeAddress(true);
    setAddress(emptyAddress);
  }

  function canContinueFromCustomer() {
    // Existing: ID is enough (profile already has contact info).
    if (customerMode === "existing") {
      return Boolean(customerId);
    }
    const email = customerEmail.trim().toLowerCase();
    return email.includes("@") && email.length >= 5;
  }

  function canContinueFromItems() {
    return lines.length > 0 && lines.every((line) => line.quantity > 0);
  }

  const orderSteps = useMemo(
    () => [
      {
        id: "customer",
        label: t("orders.create.stepCustomer"),
        shortLabel: t("orders.create.stepCustomer"),
      },
      {
        id: "items",
        label: t("orders.create.stepItems"),
        shortLabel: t("orders.create.stepItems"),
      },
      {
        id: "delivery",
        label: t("orders.create.stepDelivery"),
        shortLabel: t("orders.create.stepDelivery"),
      },
    ],
    [t],
  );

  /** Steps already passed through (forward navigation only lands after guards). */
  const completedStepIndexes = useMemo(() => {
    const done: number[] = [];
    if (step > 0) done.push(0);
    if (step > 1) done.push(1);
    return done;
  }, [step]);

  /**
   * Jump rules: free back; forward only if every intermediate step is valid.
   */
  function goToStep(target: number) {
    if (target === step || target < 0 || target > 2) return;
    setError(null);

    if (target < step) {
      setStep(target);
      return;
    }

    for (let i = step; i < target; i++) {
      if (i === 0 && !canContinueFromCustomer()) {
        setStep(0);
        toast.error(t("orders.create.guardCustomer"));
        return;
      }
      if (i === 1 && !canContinueFromItems()) {
        setStep(1);
        toast.error(t("orders.create.guardItems"));
        return;
      }
    }

    setStep(target);
  }

  function selectExistingCustomer(id: string) {
    const customer = customers.find((item) => item.id === id);
    // Always keep the id so Continue can enable even if catalog metadata is thin.
    setCustomerMode("existing");
    setCustomerId(id);
    if (!customer) return;
    setCustomerEmail(customer.email ?? "");
    setCustomerFirstName(customer.firstName ?? "");
    setCustomerLastName(customer.lastName ?? "");
    setCustomerPhone(customer.phone ?? "");
    setAddress((current) => ({
      ...current,
      firstName: customer.firstName ?? current.firstName,
      lastName: customer.lastName ?? current.lastName,
      phone: customer.phone ?? current.phone,
    }));
  }

  function switchToNewCustomer() {
    setCustomerMode("new");
    setCustomerId(null);
    setCustomerEmail("");
    setCustomerFirstName("");
    setCustomerLastName("");
    setCustomerPhone("");
  }

  function setSelectedVariantIds(ids: string[]) {
    setLines((current) => {
      const quantityById = new Map(current.map((line) => [line.variantId, line.quantity]));
      return ids
        .filter((variantId) => {
          const available = variantById.get(variantId)?.availableQuantity;
          // Block zero-stock tracked variants from entering the order.
          return !(typeof available === "number" && available <= 0);
        })
        .map((variantId) => {
          const available = variantById.get(variantId)?.availableQuantity;
          let quantity = quantityById.get(variantId) ?? 1;
          if (typeof available === "number" && available >= 0) {
            quantity = Math.min(Math.max(quantity, 1), Math.max(available, 1));
          }
          return { quantity, variantId };
        });
    });
  }

  function setLineQuantity(variantId: string, quantity: string) {
    const next = Number.parseInt(quantity, 10);
    const available = variantById.get(variantId)?.availableQuantity;
    let resolved = Number.isFinite(next) && next > 0 ? next : 1;
    if (typeof available === "number" && available >= 0) {
      resolved = Math.min(resolved, Math.max(available, 1));
    }
    setLines((current) =>
      current.map((line) =>
        line.variantId === variantId ? { ...line, quantity: resolved } : line,
      ),
    );
  }

  function removeLine(variantId: string) {
    setLines((current) => current.filter((line) => line.variantId !== variantId));
  }

  async function create() {
    if (!canContinueFromCustomer() || !canContinueFromItems()) return;
    setSaving(true);
    setError(null);

    const payload = {
      customerEmail: customerEmail.trim().toLowerCase(),
      customerFirstName: customerFirstName.trim() || null,
      customerId: customerMode === "existing" ? customerId : null,
      customerLastName: customerLastName.trim() || null,
      customerPhone: customerPhone.trim() || null,
      items: lines.map((line) => ({
        quantity: line.quantity,
        variantId: line.variantId,
      })),
      note: note.trim() || null,
      shippingAddress: includeAddress
        ? {
            address1: address.address1.trim() || null,
            city: address.city.trim() || null,
            countryCode: "et",
            firstName: address.firstName.trim() || customerFirstName.trim() || null,
            lastName: address.lastName.trim() || customerLastName.trim() || null,
            phone: address.phone.trim() || customerPhone.trim() || null,
            province: address.province.trim() || null,
          }
        : null,
    };

    const response = await fetch("/admin/orders/actions/create", {
      body: JSON.stringify(payload),
      headers: {
        accept: "application/json",
        "content-type": "application/json",
      },
      method: "POST",
    }).catch(() => null);

    setSaving(false);

    if (!response?.ok) {
      const data = (await response?.json().catch(() => ({}))) as { error?: string };
      setError(
        mapPlatformErrorMessage(data.error, {
          fallback: t("orders.create.toastError"),
          resource: "Order",
        }),
      );
      return;
    }

    const data = (await response.json().catch(() => ({}))) as {
      order?: { displayId?: string | number | null; id?: string };
    };

    toast.success(
      data.order?.id
        ? `Order ${String(data.order.id).replace(/^order_/i, "").slice(-6).toUpperCase()} created.`
        : t("orders.create.toastCreated"),
    );
    setOpen(false);
    reset();

    if (data.order?.id) {
      router.push(dashboardRoutes.orderDetail(data.order.id));
      router.refresh();
      return;
    }

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
          <AppIcons.orders data-icon="inline-start" />
          {t("orders.create.trigger")}
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[min(92dvh,44rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="shrink-0 gap-1.5 border-b border-border/70 px-4 py-4 text-left sm:px-5">
          <DialogTitle>{t("orders.create.title")}</DialogTitle>
          <DialogDescription>{t("orders.create.description")}</DialogDescription>
        </DialogHeader>
        <DialogStepRail
          ariaLabel={t("orders.create.stepsAria")}
          className="shrink-0"
          currentId={orderSteps[step]?.id ?? "customer"}
          getStatus={(_s, index) =>
            getDialogStepStatus({
              index,
              currentIndex: step,
              completedIndexes: completedStepIndexes,
            })
          }
          onSelect={(id) => {
            const index = orderSteps.findIndex((s) => s.id === id);
            if (index >= 0) goToStep(index);
          }}
          steps={orderSteps}
          variant="compact"
        />

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-5">
          {error ? (
            <Alert className="mb-4" variant="destructive">
              <AlertTitle>{t("orders.create.notCreatedTitle")}</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <DialogStepPanel stepKey={step}>
          {step === 0 ? (
            <div className="space-y-5">
              <section className="grid gap-2 sm:grid-cols-2">
                <button
                  className={cn(
                    "rounded-xl border px-3.5 py-3 text-left transition-colors",
                    customerMode === "existing"
                      ? "border-primary bg-primary/5"
                      : "hover:border-border hover:bg-muted/40",
                  )}
                  onClick={() => setCustomerMode("existing")}
                  type="button"
                >
                  <p className="text-sm font-medium">{t("orders.create.existingCustomer")}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {t("orders.create.existingCustomerDesc")}
                  </p>
                </button>
                <button
                  className={cn(
                    "rounded-xl border px-3.5 py-3 text-left transition-colors",
                    customerMode === "new"
                      ? "border-primary bg-primary/5"
                      : "hover:border-border hover:bg-muted/40",
                  )}
                  onClick={switchToNewCustomer}
                  type="button"
                >
                  <p className="text-sm font-medium">{t("orders.create.newCustomer")}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {t("orders.create.newCustomerDesc")}
                  </p>
                </button>
              </section>

              {customerMode === "existing" ? (
                <Field>
                  <FieldLabel>{t("orders.create.customer")}</FieldLabel>
                  <CustomerPicker
                    catalog={customers}
                    loading={catalogLoading}
                    onChange={selectExistingCustomer}
                    selectedId={customerId}
                    selectedLabel={selectedCustomer?.label ?? null}
                  />
                  <FieldDescription>
                    {t("orders.create.customerNotFound")}
                  </FieldDescription>
                </Field>
              ) : (
                <section className="grid gap-4 sm:grid-cols-2">
                  <Field className="sm:col-span-2">
                    <FieldLabel htmlFor="mo-email">{t("orders.create.email")}</FieldLabel>
                    <Input
                      autoComplete="email"
                      id="mo-email"
                      onChange={(event) => setCustomerEmail(event.target.value)}
                      placeholder={t("orders.create.emailPlaceholder")}
                      type="email"
                      value={customerEmail}
                    />
                    <FieldDescription>
                      {t("orders.create.emailDesc")}
                    </FieldDescription>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="mo-cf">{t("orders.create.firstName")}</FieldLabel>
                    <Input
                      id="mo-cf"
                      onChange={(event) => setCustomerFirstName(event.target.value)}
                      value={customerFirstName}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="mo-cl">{t("orders.create.lastName")}</FieldLabel>
                    <Input
                      id="mo-cl"
                      onChange={(event) => setCustomerLastName(event.target.value)}
                      value={customerLastName}
                    />
                  </Field>
                  <Field className="sm:col-span-2">
                    <FieldLabel htmlFor="mo-cp">{t("orders.create.phone")}</FieldLabel>
                    <Input
                      id="mo-cp"
                      onChange={(event) => setCustomerPhone(event.target.value)}
                      placeholder={t("orders.create.phonePlaceholder")}
                      value={customerPhone}
                    />
                  </Field>
                </section>
              )}
            </div>
          ) : null}

          {step === 1 ? (
            <div className="space-y-5">
              <section className="space-y-3">
                <div>
                  <p className="text-sm font-medium">{t("orders.create.products")}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {t("orders.create.productsDesc")}
                  </p>
                </div>
                <ProductCatalogPickerTrigger
                  disabled={catalogLoading && variants.length === 0}
                  loading={catalogLoading}
                  onClick={() => setProductPickerOpen(true)}
                  selectedCount={lines.length}
                />
                <ProductCatalogPickerDialog
                  description={t("orders.create.productsDesc")}
                  hasMore={catalogHasMore}
                  loading={catalogLoading}
                  loadingMore={catalogLoadingMore}
                  onConfirm={setSelectedVariantIds}
                  onLoadMore={() => void loadProductCatalog(catalogOffset, true)}
                  onOpenChange={setProductPickerOpen}
                  open={productPickerOpen}
                  products={productPickerCatalog}
                  searchPlaceholder={t("orders.create.searchProducts")}
                  selectedIds={lines.map((line) => line.variantId)}
                  selectionMode="multiple"
                  selectionTarget="variant"
                  title={t("orders.create.products")}
                />
              </section>

              {lines.length > 0 ? (
                <section className="space-y-2 border-t pt-5">
                  <p className="text-sm font-medium">{t("orders.create.quantities")}</p>
                  <ul className="space-y-2">
                    {lines.map((line) => {
                      const variant = variantById.get(line.variantId);
                      return (
                        <li
                          className="grid gap-2 rounded-xl border px-3 py-2.5 sm:grid-cols-[minmax(0,1fr)_6rem_auto] sm:items-center"
                          key={line.variantId}
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">
                              {variant?.label ?? line.variantId}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {[
                                variant?.sku
                                  ? t("products.catalogPicker.skuLabel", { sku: variant.sku })
                                  : null,
                                variant?.priceLabel,
                              ]
                                .filter(Boolean)
                                .join(" · ") || t("orders.create.optionFallback")}
                            </p>
                          </div>
                          <Input
                            aria-label={t("orders.create.quantityFor", { name: variant?.label ?? t("orders.create.optionFallback") })}
                            max={
                              typeof variant?.availableQuantity === "number"
                                ? Math.max(variant.availableQuantity, 1)
                                : undefined
                            }
                            min={1}
                            onChange={(event) =>
                              setLineQuantity(line.variantId, event.target.value)
                            }
                            type="number"
                            value={String(line.quantity)}
                          />
                          <Button
                            aria-label={t("orders.create.removeItem")}
                            onClick={() => removeLine(line.variantId)}
                            size="icon-sm"
                            type="button"
                            variant="ghost"
                          >
                            <AppIcons.trash className="size-4" />
                          </Button>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ) : null}
            </div>
          ) : null}

          {step === 2 ? (
            <div className="space-y-5">
              <section className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <p className="text-sm font-medium">{t("orders.create.review")}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {t("orders.create.reviewDesc")}
                  </p>
                </div>
                <div className="rounded-xl border px-3.5 py-3 sm:col-span-2">
                  <dl className="space-y-1.5 text-sm">
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted-foreground">{t("orders.create.customer")}</dt>
                      <dd className="truncate font-medium">{customerEmail || "—"}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted-foreground">{t("orders.create.items")}</dt>
                      <dd className="font-medium">
                        {t("orders.create.itemsSummary", { units: lines.reduce((sum, line) => sum + line.quantity, 0), lines: lines.length })}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted-foreground">{t("orders.create.payment")}</dt>
                      <dd className="font-medium">{t("orders.create.cash")}</dd>
                    </div>
                  </dl>
                </div>
              </section>

              <section className="grid gap-4 border-t pt-5 sm:grid-cols-2">
                <div className="flex items-start justify-between gap-3 sm:col-span-2">
                  <div>
                    <p className="text-sm font-medium">{t("orders.create.shippingAddress")}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {t("orders.create.shippingAddressDesc")}
                    </p>
                  </div>
                  <Button
                    onClick={() => setIncludeAddress((value) => !value)}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    {includeAddress ? t("orders.create.included") : t("orders.create.skipped")}
                  </Button>
                </div>

                {includeAddress ? (
                  <>
                    <Field>
                      <FieldLabel htmlFor="mo-af">{t("orders.create.firstName")}</FieldLabel>
                      <Input
                        id="mo-af"
                        onChange={(event) =>
                          setAddress((current) => ({ ...current, firstName: event.target.value }))
                        }
                        value={address.firstName}
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="mo-al">{t("orders.create.lastName")}</FieldLabel>
                      <Input
                        id="mo-al"
                        onChange={(event) =>
                          setAddress((current) => ({ ...current, lastName: event.target.value }))
                        }
                        value={address.lastName}
                      />
                    </Field>
                    <Field className="sm:col-span-2">
                      <FieldLabel htmlFor="mo-a1">{t("orders.create.address")}</FieldLabel>
                      <Input
                        id="mo-a1"
                        onChange={(event) =>
                          setAddress((current) => ({ ...current, address1: event.target.value }))
                        }
                        placeholder={t("orders.create.addressPlaceholder")}
                        value={address.address1}
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="mo-city">{t("orders.create.city")}</FieldLabel>
                      <Input
                        id="mo-city"
                        onChange={(event) =>
                          setAddress((current) => ({ ...current, city: event.target.value }))
                        }
                        value={address.city}
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="mo-zone">{t("orders.create.region")}</FieldLabel>
                      <Input
                        id="mo-zone"
                        onChange={(event) =>
                          setAddress((current) => ({ ...current, province: event.target.value }))
                        }
                        value={address.province}
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="mo-ph">{t("orders.create.phone")}</FieldLabel>
                      <Input
                        id="mo-ph"
                        onChange={(event) =>
                          setAddress((current) => ({ ...current, phone: event.target.value }))
                        }
                        value={address.phone}
                      />
                    </Field>
                    <Field>
                      <FieldLabel>{t("orders.create.country")}</FieldLabel>
                      <Input disabled readOnly value={t("orders.create.ethiopia")} />
                      <FieldDescription>{t("orders.create.countryFixed")}</FieldDescription>
                    </Field>
                  </>
                ) : null}
              </section>

              <section className="border-t pt-5">
                <Field>
                  <FieldLabel htmlFor="mo-note">{t("orders.create.internalNote")}</FieldLabel>
                  <Textarea
                    id="mo-note"
                    onChange={(event) => setNote(event.target.value)}
                    placeholder={t("orders.create.notePlaceholder")}
                    rows={2}
                    value={note}
                  />
                </Field>
              </section>
            </div>
          ) : null}
          </DialogStepPanel>
        </div>

        {/* p-0 dialogs: no negative footer margins (avoids weird bottom corner clip). */}
        <DialogFooter className="m-0 shrink-0 rounded-b-xl border-t border-border/70 bg-muted/40 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
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
              disabled={
                (step === 0 && !canContinueFromCustomer()) ||
                (step === 1 && !canContinueFromItems())
              }
              onClick={() => goToStep(step + 1)}
              type="button"
            >
              {t("common.continue")}
            </Button>
          ) : (
            <Button
              disabled={saving || !canContinueFromCustomer() || !canContinueFromItems()}
              onClick={() => void create()}
              type="button"
            >
              {saving ? t("orders.create.creating") : t("orders.create.trigger")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

