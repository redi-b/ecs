"use client";

import { useRouter } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { AppIcons } from "@/components/app/icons";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { useCreateQueryOpen } from "@/lib/use-create-query-open";
import { Textarea } from "@/components/ui/textarea";
import { mapPlatformErrorMessage } from "@/lib/platform-api/errors";
import { dashboardRoutes } from "@/lib/routes";
import { useI18n } from "@/i18n/provider";
import { cn } from "@/lib/utils";

type CatalogVariant = {
  id: string;
  label: string;
  priceLabel: string | null;
  productTitle: string;
  sku: string | null;
};

type CustomerOption = {
  email: string;
  firstName: string | null;
  id: string;
  label: string;
  lastName: string | null;
  phone: string | null;
};

type LineItem = {
  quantity: number;
  variantId: string;
};

type AddressForm = {
  address1: string;
  city: string;
  firstName: string;
  lastName: string;
  phone: string;
  province: string;
};

const emptyAddress: AddressForm = {
  address1: "",
  city: "",
  firstName: "",
  lastName: "",
  phone: "",
  province: "",
};

function CreateOrderTriggerButton({ disabled }: { disabled?: boolean }) {
  const { t } = useI18n();
  return (
    <Button type="button" disabled={disabled}>
      <AppIcons.orders data-icon="inline-start" />
      {t("orders.create.trigger")}
    </Button>
  );
}

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

  useEffect(() => {
    if (!open) return;

    setCatalogLoading(true);
    void Promise.all([
      fetch("/admin/products/actions/list?limit=100", {
        headers: { accept: "application/json" },
      })
        .then(async (response) => {
          const data = (await response.json().catch(() => ({}))) as {
            products?: Array<{
              title?: string | null;
              variants?: Array<{
                id: string;
                prices?: Array<{ amount?: number | null; currencyCode?: string | null }>;
                sku?: string | null;
                title?: string | null;
              }>;
            }>;
          };
          if (!response.ok || !Array.isArray(data.products)) return [] as CatalogVariant[];
          return data.products.flatMap((product) =>
            (product.variants ?? []).map((variant) => {
              const price = variant.prices?.[0];
              const priceLabel =
                price?.amount != null
                  ? formatPrice(price.amount, price.currencyCode ?? "etb")
                  : null;
              return {
                id: variant.id,
                label: [product.title ?? t("orders.create.productFallback"), variant.title ?? t("orders.create.defaultOption")]
                  .filter(Boolean)
                  .join(" · "),
                priceLabel,
                productTitle: product.title ?? t("orders.create.productFallback"),
                sku: variant.sku ?? null,
              };
            }),
          );
        })
        .catch(() => [] as CatalogVariant[]),
      fetch("/admin/customers/actions/list?limit=100", {
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
        .catch(() => [] as CustomerOption[]),
    ])
      .then(([nextVariants, nextCustomers]) => {
        setVariants(nextVariants);
        setCustomers(nextCustomers);
      })
      .finally(() => setCatalogLoading(false));
  }, [open]);

  const selectedCustomer = useMemo(
    () => customers.find((customer) => customer.id === customerId) ?? null,
    [customerId, customers],
  );

  const variantById = useMemo(
    () => new Map(variants.map((variant) => [variant.id, variant])),
    [variants],
  );

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
    const email = customerEmail.trim().toLowerCase();
    if (!email.includes("@") || email.length < 5) return false;
    if (customerMode === "existing" && !customerId) return false;
    return true;
  }

  function canContinueFromItems() {
    return lines.length > 0 && lines.every((line) => line.quantity > 0);
  }

  function selectExistingCustomer(id: string) {
    const customer = customers.find((item) => item.id === id);
    if (!customer) return;
    setCustomerMode("existing");
    setCustomerId(customer.id);
    setCustomerEmail(customer.email);
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
      return ids.map((variantId) => ({
        quantity: quantityById.get(variantId) ?? 1,
        variantId,
      }));
    });
  }

  function setLineQuantity(variantId: string, quantity: string) {
    const next = Number.parseInt(quantity, 10);
    setLines((current) =>
      current.map((line) =>
        line.variantId === variantId
          ? { ...line, quantity: Number.isFinite(next) && next > 0 ? next : 1 }
          : line,
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
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="gap-1.5 border-b px-4 py-4 text-left sm:px-5">
          <DialogTitle>{t("orders.create.title")}</DialogTitle>
          <DialogDescription>{t("orders.create.description")}</DialogDescription>
          <ol className="mt-3 flex flex-wrap gap-2 text-xs">
            {[t("orders.create.stepCustomer"), t("orders.create.stepItems"), t("orders.create.stepDelivery")].map((label, index) => (
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
          {error ? (
            <Alert className="mb-4" variant="destructive">
              <AlertTitle>{t("orders.create.notCreatedTitle")}</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

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
                <VariantMultiPicker
                  catalog={variants}
                  loading={catalogLoading}
                  onChange={setSelectedVariantIds}
                  selectedIds={lines.map((line) => line.variantId)}
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
                              {[variant?.sku, variant?.priceLabel].filter(Boolean).join(" · ") || t("orders.create.optionFallback")}
                            </p>
                          </div>
                          <Input
                            aria-label={t("orders.create.quantityFor", { name: variant?.label ?? t("orders.create.optionFallback") })}
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
        </div>

        <DialogFooter className="mx-0 mb-0 rounded-none border-t bg-muted/50 p-4 sm:justify-between">
          <div className="flex gap-2">
            {step > 0 ? (
              <Button onClick={() => setStep((value) => value - 1)} type="button" variant="outline">
                {t("common.back")}
              </Button>
            ) : (
              <Button onClick={() => setOpen(false)} type="button" variant="outline">
                {t("common.cancel")}
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            {step < 2 ? (
              <Button
                disabled={
                  (step === 0 && !canContinueFromCustomer()) ||
                  (step === 1 && !canContinueFromItems())
                }
                onClick={() => {
                  setError(null);
                  setStep((value) => value + 1);
                }}
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
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CustomerPicker({
  catalog,
  loading,
  onChange,
  selectedId,
  selectedLabel,
}: {
  catalog: CustomerOption[];
  loading: boolean;
  onChange: (id: string) => void;
  selectedId: string | null;
  selectedLabel: string | null;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger asChild>
        <Button
          className={cn(
            "h-8 w-full justify-between px-2.5 font-normal shadow-none",
            !selectedId && "text-muted-foreground",
          )}
          role="combobox"
          type="button"
          variant="outline"
        >
          <span className="truncate">
            {loading ? t("orders.create.loadingCustomers") : selectedLabel ? selectedLabel : t("orders.create.selectCustomer")}
          </span>
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
          <CommandInput placeholder={t("orders.create.searchCustomer")} />
          <CommandList
            className="max-h-60 overflow-y-auto overscroll-contain"
            onWheel={(event) => event.stopPropagation()}
          >
            <CommandEmpty>{t("orders.create.noCustomers")}</CommandEmpty>
            <CommandGroup className="overflow-visible">
              {catalog.map((customer) => {
                const isSelected = customer.id === selectedId;
                return (
                  <CommandItem
                    data-checked={isSelected ? true : undefined}
                    key={customer.id}
                    onSelect={() => {
                      onChange(customer.id);
                      setOpen(false);
                    }}
                    value={`${customer.label} ${customer.email} ${customer.phone ?? ""}`}
                  >
                    <Checkbox checked={isSelected} tabIndex={-1} />
                    <span className="min-w-0 flex-1 truncate">{customer.label}</span>
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

function VariantMultiPicker({
  catalog,
  loading,
  onChange,
  selectedIds,
}: {
  catalog: CatalogVariant[];
  loading: boolean;
  onChange: (ids: string[]) => void;
  selectedIds: string[];
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);

  function toggle(id: string) {
    if (selected.has(id)) onChange(selectedIds.filter((item) => item !== id));
    else onChange([...selectedIds, id]);
  }

  const label =
    selectedIds.length === 0
      ? loading
        ? t("orders.create.loadingProducts")
        : t("orders.create.selectProducts")
      : selectedIds.length === 1
        ? t("common.productSelected")
        : t("common.productsSelected", { count: selectedIds.length });

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
          <CommandInput placeholder={t("orders.create.searchProducts")} />
          <CommandList
            className="max-h-60 overflow-y-auto overscroll-contain"
            onWheel={(event) => event.stopPropagation()}
          >
            <CommandEmpty>{t("orders.create.noProducts")}</CommandEmpty>
            <CommandGroup className="overflow-visible">
              {catalog.map((variant) => {
                const isSelected = selected.has(variant.id);
                return (
                  <CommandItem
                    data-checked={isSelected ? true : undefined}
                    key={variant.id}
                    onSelect={() => toggle(variant.id)}
                    value={`${variant.label} ${variant.sku ?? ""} ${variant.productTitle}`}
                  >
                    <Checkbox checked={isSelected} tabIndex={-1} />
                    <span className="min-w-0 flex-1 truncate">
                      {variant.label}
                      {variant.sku ? ` · ${variant.sku}` : ""}
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

function formatPrice(amount: number, currencyCode: string) {
  try {
    return new Intl.NumberFormat("en-ET", {
      currency: currencyCode.toUpperCase(),
      maximumFractionDigits: 2,
      style: "currency",
    }).format(amount);
  } catch {
    return `${amount} ${currencyCode.toUpperCase()}`;
  }
}
