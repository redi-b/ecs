"use client";

import type {
  MerchantSaleDraft,
  MerchantSaleDraftContent,
  MerchantSaleDraftSummary,
} from "@ecs/contracts";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { useAccess, usePermission } from "@/components/app/access-context";
import { useActor } from "@/components/app/actor-context";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { AppIcons } from "@/components/app/icons";
import { LanguageSwitcher } from "@/components/app/language-switcher";
import { ThemeToggle } from "@/components/app/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useI18n } from "@/i18n/provider";
import { createClientId } from "@/lib/client-id";
import { dashboardRoutes } from "@/lib/routes";
import { QuickSaleCart, type QuickSaleStage } from "./quick-sale-cart";
import { QuickSaleCatalog } from "./quick-sale-catalog";
import type {
  CatalogCategory,
  CatalogCategoryResponse,
  CatalogResponse,
  DiscountType,
  QuickSaleProduct,
  SaleLine,
  Tender,
  VariantDetail,
} from "./quick-sale-model";
import { mapCatalog, mergeProducts, mergeVariantDetails } from "./quick-sale-model";

type CompletedSale = { orderId: string; paid: boolean };

export function QuickSaleWorkspace({
  initialDraftId,
  initialDrafts,
}: {
  initialDraftId: string | null;
  initialDrafts: MerchantSaleDraftSummary[];
}) {
  const { actor } = useActor();
  const { tenant } = useAccess();
  const { formatDate, t } = useI18n();
  const router = useRouter();
  const [exiting, startExit] = useTransition();
  const canUpdate = usePermission("orders.update");
  const [catalog, setCatalog] = useState<QuickSaleProduct[]>([]);
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [variants, setVariants] = useState<VariantDetail[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogLoadingMore, setCatalogLoadingMore] = useState(false);
  const [catalogError, setCatalogError] = useState(false);
  const [catalogOffset, setCatalogOffset] = useState(0);
  const [catalogHasMore, setCatalogHasMore] = useState(false);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [categoriesError, setCategoriesError] = useState(false);
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState("all");
  const [lines, setLines] = useState<SaleLine[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [discountType, setDiscountType] = useState<DiscountType>("none");
  const [discountValue, setDiscountValue] = useState("");
  const [adjustmentReason, setAdjustmentReason] = useState("");
  const [tender, setTender] = useState<Tender>("cash");
  const [reference, setReference] = useState("");
  const [cashReceived, setCashReceived] = useState("");
  const [draftId, setDraftId] = useState<string | null>(null);
  const [draftRevision, setDraftRevision] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [mobileCartOpen, setMobileCartOpen] = useState(false);
  const mobileCartTriggerRef = useRef<HTMLButtonElement>(null);
  const [savedSalesOpen, setSavedSalesOpen] = useState(false);
  const [savedSales, setSavedSales] = useState(initialDrafts);
  const [deletingDraftId, setDeletingDraftId] = useState<string | null>(null);
  const [stage, setStage] = useState<QuickSaleStage>("cart");
  const [completedSale, setCompletedSale] = useState<CompletedSale | null>(null);
  const saveKey = useRef<{ fingerprint: string; key: string } | null>(null);
  const completionKey = useRef<{ fingerprint: string; key: string } | null>(null);
  const catalogRequest = useRef(0);

  // Categories are a small, independently cached selector dataset.
  // biome-ignore lint/correctness/useExhaustiveDependencies: categories load once and refresh explicitly.
  useEffect(() => {
    void loadCategories();
  }, []);

  // Search and category filtering stay server-owned so large catalogs are not
  // limited to whichever page happens to be loaded in the browser.
  // biome-ignore lint/correctness/useExhaustiveDependencies: the filter values are the request boundary.
  useEffect(() => {
    const timeout = window.setTimeout(
      () => void loadCatalog(0, false, { categoryId, query }),
      query.trim() ? 250 : 0,
    );
    return () => window.clearTimeout(timeout);
  }, [categoryId, query]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: URL draft identity is the restore boundary.
  useEffect(() => {
    if (!initialDraftId) return;
    void restoreDraftById(initialDraftId);
  }, [initialDraftId]);

  async function loadCatalog(
    offset: number,
    append: boolean,
    filters: { categoryId: string; query: string },
  ) {
    const requestId = ++catalogRequest.current;
    append ? setCatalogLoadingMore(true) : setCatalogLoading(true);
    if (!append) setCatalogError(false);
    const params = new URLSearchParams({ limit: "40", offset: String(offset) });
    if (filters.query.trim()) params.set("q", filters.query.trim());
    if (filters.categoryId !== "all") params.set("categoryId", filters.categoryId);
    const response = await fetch(`${dashboardRoutes.productListAction}?${params.toString()}`, {
      headers: { accept: "application/json" },
    }).catch(() => null);
    const data = (await response?.json().catch(() => null)) as CatalogResponse | null;
    if (requestId !== catalogRequest.current) return;
    if (!response?.ok || !data?.products) {
      if (append) toast.error(t("quickSale.loadFailed"));
      else setCatalogError(true);
      setCatalogLoading(false);
      setCatalogLoadingMore(false);
      return;
    }
    const mapped = mapCatalog(data.products, t);
    setCatalogError(false);
    setCatalog((current) => (append ? mergeProducts(current, mapped.products) : mapped.products));
    setVariants((current) =>
      append ? mergeVariantDetails(current, mapped.variants) : mapped.variants,
    );
    const nextOffset = offset + data.products.length;
    setCatalogOffset(nextOffset);
    setCatalogHasMore(nextOffset < (data.count ?? nextOffset));
    setCatalogLoading(false);
    setCatalogLoadingMore(false);
  }

  async function loadCategories() {
    setCategoriesLoading(true);
    setCategoriesError(false);
    const response = await fetch(`${dashboardRoutes.productCategoriesListAction}?limit=100`, {
      headers: { accept: "application/json" },
    }).catch(() => null);
    const data = (await response?.json().catch(() => null)) as CatalogCategoryResponse | null;
    if (!response?.ok || !data?.categories) {
      setCategoriesError(true);
      setCategoriesLoading(false);
      return;
    }
    setCategories(
      data.categories.flatMap((category) =>
        category.name
          ? [{ id: category.id, mediaUrl: category.mediaUrl ?? null, name: category.name }]
          : [],
      ),
    );
    setCategoriesLoading(false);
  }

  async function refreshCatalog() {
    await Promise.all([loadCatalog(0, false, { categoryId, query }), loadCategories()]);
  }

  const variantById = useMemo(
    () => new Map(variants.map((variant) => [variant.variantId, variant])),
    [variants],
  );
  const productById = useMemo(
    () => new Map(catalog.map((product) => [product.id, product])),
    [catalog],
  );
  const subtotal = lines.reduce((sum, line) => {
    const price = line.unitPrice ?? variantById.get(line.variantId)?.priceAmount ?? 0;
    return sum + price * line.quantity;
  }, 0);
  const parsedDiscount = Number(discountValue);
  const discount =
    discountType === "percentage" && Number.isFinite(parsedDiscount)
      ? subtotal * (parsedDiscount / 100)
      : discountType === "fixed" && Number.isFinite(parsedDiscount)
        ? parsedDiscount
        : 0;
  const total = Math.max(0, subtotal - discount);
  const received = Number(cashReceived);
  const change = Number.isFinite(received) ? Math.max(0, received - total) : 0;
  const hasOverride = lines.some((line) => line.unitPrice != null);
  const adjustmentValid =
    (!hasOverride && discountType === "none") ||
    (canUpdate &&
      adjustmentReason.trim().length >= 3 &&
      discount >= 0 &&
      discount <= subtotal &&
      (discountType === "none" || (parsedDiscount > 0 && parsedDiscount <= 100_000_000)) &&
      (discountType !== "percentage" || parsedDiscount <= 100));
  const cartValid =
    lines.length > 0 &&
    lines.every((line) => {
      const available = variantById.get(line.variantId)?.availableQuantity;
      return line.quantity > 0 && (available == null || line.quantity <= available);
    }) &&
    adjustmentValid;

  function addVariant(variantId: string) {
    const variant = variantById.get(variantId);
    setLines((current) => {
      const existing = current.find((line) => line.variantId === variantId);
      if (!existing) return [...current, { quantity: 1, unitPrice: null, variantId }];
      if (variant?.availableQuantity != null && existing.quantity >= variant.availableQuantity) {
        toast.error(t("quickSale.stockLimit"));
        return current;
      }
      return current.map((line) =>
        line.variantId === variantId ? { ...line, quantity: line.quantity + 1 } : line,
      );
    });
  }

  function updateLine(variantId: string, change: Partial<SaleLine> | null) {
    setLines((current) =>
      change
        ? current.map((line) =>
            line.variantId === variantId ? { ...line, ...change, variantId } : line,
          )
        : current.filter((line) => line.variantId !== variantId),
    );
  }

  function content(): MerchantSaleDraftContent {
    const [firstName, ...rest] = customerName.trim().split(/\s+/);
    return {
      adjustmentReason: adjustmentReason.trim() || null,
      channel: "pos",
      currencyCode: "etb",
      currentStep: 1,
      customer: {
        email: customerEmail.trim().toLowerCase() || null,
        firstName: firstName || null,
        lastName: rest.join(" ") || null,
        phone: customerPhone.trim() || null,
      },
      discount: discountType === "none" ? null : { type: discountType, value: parsedDiscount },
      items: lines.map((line) => {
        const variant = variantById.get(line.variantId);
        return {
          productId: variant?.productId ?? `unknown:${line.variantId}`,
          productTitle: variant?.productTitle ?? null,
          quantity: line.quantity,
          sku: variant?.sku ?? null,
          unitPrice: line.unitPrice,
          variantId: line.variantId,
          variantTitle: variant?.variantTitle ?? null,
        };
      }),
      note: null,
      shippingAddress: null,
      shippingOptionId: null,
    };
  }

  async function saveCart() {
    if (!cartValid) return toast.error(t("quickSale.invalid"));
    const payload = content();
    const fingerprint = JSON.stringify({ draftId, draftRevision, payload });
    if (saveKey.current?.fingerprint !== fingerprint) {
      saveKey.current = { fingerprint, key: createClientId("quick-sale-draft") };
    }
    setSaving(true);
    const response = await fetch(
      draftId ? dashboardRoutes.orderDraftAction(draftId) : dashboardRoutes.orderDraftsAction,
      {
        body: JSON.stringify({
          ...payload,
          ...(draftRevision ? { expectedRevision: draftRevision } : {}),
        }),
        headers: { "content-type": "application/json", "idempotency-key": saveKey.current.key },
        method: "POST",
      },
    ).catch(() => null);
    const data = (await response?.json().catch(() => null)) as { draft?: MerchantSaleDraft } | null;
    setSaving(false);
    if (!response?.ok || !data?.draft) return toast.error(t("quickSale.saveFailed"));
    const savedDraft = data.draft;
    setDraftId(savedDraft.id);
    setDraftRevision(savedDraft.revision);
    setSavedSales((current) => [
      {
        channel: savedDraft.channel,
        createdAt: savedDraft.createdAt,
        currentStep: savedDraft.currentStep,
        customerLabel:
          [savedDraft.customer.firstName, savedDraft.customer.lastName].filter(Boolean).join(" ") ||
          savedDraft.customer.phone ||
          savedDraft.customer.email ||
          null,
        id: savedDraft.id,
        itemCount: savedDraft.items.reduce((sum, item) => sum + item.quantity, 0),
        ownerUserId: savedDraft.ownerUserId,
        revision: savedDraft.revision,
        updatedAt: savedDraft.updatedAt,
      },
      ...current.filter((draft) => draft.id !== savedDraft.id),
    ]);
    toast.success(t("quickSale.saved"));
  }

  async function complete(completion: "paid" | "pay_later") {
    if (!cartValid || (completion === "paid" && !canUpdate)) {
      return toast.error(t("quickSale.invalid"));
    }
    if (completion === "paid" && tender === "cash" && cashReceived && received < total) {
      return toast.error(t("quickSale.cashShort"));
    }
    const [firstName, ...rest] = customerName.trim().split(/\s+/);
    const payload = {
      completion,
      order: {
        adjustmentReason: adjustmentReason.trim() || null,
        customerEmail: customerEmail.trim().toLowerCase() || null,
        customerFirstName: firstName || null,
        customerLastName: rest.join(" ") || null,
        customerPhone: customerPhone.trim() || null,
        discount: discountType === "none" ? null : { type: discountType, value: parsedDiscount },
        items: lines.map((line) => ({
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          variantId: line.variantId,
        })),
        shippingAddress: null,
      },
      reference: reference.trim() || undefined,
      settlementMethod: tender,
    };
    const fingerprint = JSON.stringify(payload);
    if (completionKey.current?.fingerprint !== fingerprint) {
      completionKey.current = { fingerprint, key: createClientId("quick-sale") };
    }
    setCompleting(true);
    const response = await fetch(dashboardRoutes.posAction, {
      body: JSON.stringify(payload),
      headers: {
        "content-type": "application/json",
        "idempotency-key": completionKey.current.key,
      },
      method: "POST",
    }).catch(() => null);
    const data = (await response?.json().catch(() => null)) as {
      order?: { id?: string };
      paymentRecorded?: boolean;
    } | null;
    if (!response?.ok || !data?.order?.id) {
      setCompleting(false);
      return toast.error(t("quickSale.createFailed"));
    }
    if (draftId && draftRevision) {
      const archived = await archiveSavedSale(draftId, draftRevision);
      if (!archived) toast.warning(t("quickSale.archiveFailed"));
    }
    if (completion === "paid" && !data.paymentRecorded) {
      toast.warning(t("quickSale.paymentRepair"));
    }
    setCompleting(false);
    setCompletedSale({ orderId: data.order.id, paid: completion === "paid" });
    setStage("complete");
  }

  async function archiveSavedSale(id: string, revision: number) {
    const response = await fetch(dashboardRoutes.orderDraftAction(id), {
      body: JSON.stringify({ revision }),
      headers: {
        "content-type": "application/json",
        "idempotency-key": createClientId("quick-sale-archive"),
      },
      method: "DELETE",
    }).catch(() => null);
    if (!response?.ok && response?.status !== 404) return false;
    setSavedSales((current) => current.filter((draft) => draft.id !== id));
    return true;
  }

  async function deleteSavedSale(draft: MerchantSaleDraftSummary) {
    setDeletingDraftId(draft.id);
    const archived = await archiveSavedSale(draft.id, draft.revision);
    setDeletingDraftId(null);
    if (!archived) return toast.error(t("quickSale.deleteSavedFailed"));
    if (draftId === draft.id) clearSale();
    toast.success(t("quickSale.savedDeleted"));
  }

  async function restoreDraftById(id: string) {
    const response = await fetch(dashboardRoutes.orderDraftAction(id), {
      headers: { accept: "application/json" },
    }).catch(() => null);
    const data = (await response?.json().catch(() => null)) as {
      draft?: MerchantSaleDraft;
    } | null;
    if (!response?.ok || !data?.draft || data.draft.channel !== "pos") {
      if (response?.status === 404) {
        setSavedSales((current) => current.filter((draft) => draft.id !== id));
        toast.error(t("quickSale.savedUnavailable"));
      } else {
        toast.error(t("quickSale.saveFailed"));
      }
      return;
    }
    restoreDraft(data.draft);
    setSavedSalesOpen(false);
    setStage("cart");
  }

  function restoreDraft(draft: MerchantSaleDraft) {
    setDraftId(draft.id);
    setDraftRevision(draft.revision);
    setCustomerName([draft.customer.firstName, draft.customer.lastName].filter(Boolean).join(" "));
    setCustomerPhone(draft.customer.phone ?? "");
    setCustomerEmail(draft.customer.email ?? "");
    setDiscountType(draft.discount?.type ?? "none");
    setDiscountValue(draft.discount ? String(draft.discount.value) : "");
    setAdjustmentReason(draft.adjustmentReason ?? "");
    setLines(
      draft.items.map((item) => ({
        quantity: item.quantity,
        unitPrice: item.unitPrice ?? null,
        variantId: item.variantId,
      })),
    );
    setVariants((current) =>
      mergeVariantDetails(
        current,
        draft.items.map((item) => ({
          availableQuantity: null,
          currencyCode: "etb",
          imageUrl: null,
          priceAmount: item.unitPrice ?? null,
          priceLabel: item.unitPrice == null ? null : `${item.unitPrice} ETB`,
          productId: item.productId,
          productTitle: item.productTitle ?? item.productId,
          sku: item.sku ?? null,
          variantId: item.variantId,
          variantTitle: item.variantTitle ?? item.variantId,
        })),
      ),
    );
  }

  function clearSale() {
    setLines([]);
    setCustomerName("");
    setCustomerPhone("");
    setCustomerEmail("");
    setDiscountType("none");
    setDiscountValue("");
    setAdjustmentReason("");
    setTender("cash");
    setReference("");
    setCashReceived("");
    setDraftId(null);
    setDraftRevision(null);
    setCompletedSale(null);
    setStage("cart");
    setMobileCartOpen(false);
    saveKey.current = null;
    completionKey.current = null;
  }

  function exitQuickSale() {
    if (exiting) return;
    startExit(() => router.push(dashboardRoutes.overview));
  }

  const exitButton = (
    <Button
      aria-busy={exiting || undefined}
      aria-label={t("quickSale.exit")}
      disabled={exiting}
      size="icon-lg"
      variant="ghost"
    >
      {exiting ? <AppIcons.loader className="animate-spin" /> : <AppIcons.close />}
    </Button>
  );

  return (
    <div className="flex h-dvh min-h-0 min-w-0 flex-col overflow-hidden bg-background">
      <header className="flex min-h-14 shrink-0 flex-wrap items-center gap-2 border-b bg-card px-2 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] sm:px-3 lg:flex-nowrap">
        {lines.length > 0 ? (
          <ConfirmDialog
            confirmLabel={t("quickSale.exit")}
            description={t("quickSale.exitDescription")}
            confirmDisabled={exiting}
            onConfirm={exitQuickSale}
            title={t("quickSale.exitTitle")}
            trigger={exitButton}
          />
        ) : (
          <Button
            aria-busy={exiting || undefined}
            aria-label={t("quickSale.exit")}
            disabled={exiting}
            onClick={exitQuickSale}
            size="icon-lg"
            variant="ghost"
          >
            {exiting ? <AppIcons.loader className="animate-spin" /> : <AppIcons.close />}
          </Button>
        )}
        <div className="min-w-0 flex-1 border-l pl-3 lg:max-w-64 lg:flex-initial">
          <h1 className="truncate font-heading text-base font-semibold">{t("quickSale.title")}</h1>
          <p className="truncate text-xs text-muted-foreground">
            {t("quickSale.operatorLine", {
              cashier: actor.name ?? actor.email,
              shop: tenant?.name ?? t("quickSale.shop"),
            })}
          </p>
        </div>
        <div className="order-last w-full min-w-0 lg:order-none lg:mx-auto lg:max-w-lg lg:flex-1">
          <InputGroup className="h-9 bg-background">
            <InputGroupAddon>
              <InputGroupText>
                <AppIcons.search />
              </InputGroupText>
            </InputGroupAddon>
            <InputGroupInput
              className="text-base lg:text-sm"
              aria-label={t("quickSale.searchProducts")}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("quickSale.searchProducts")}
              type="search"
              value={query}
            />
            <InputGroupAddon align="inline-end">
              <Tooltip>
                <TooltipTrigger asChild>
                  <InputGroupButton
                    aria-label={t("quickSale.refreshProducts")}
                    disabled={catalogLoading || catalogLoadingMore}
                    onClick={() => void refreshCatalog()}
                    size="icon-xs"
                  >
                    <AppIcons.refresh className={catalogLoading ? "animate-spin" : undefined} />
                  </InputGroupButton>
                </TooltipTrigger>
                <TooltipContent>{t("quickSale.refreshProducts")}</TooltipContent>
              </Tooltip>
            </InputGroupAddon>
          </InputGroup>
        </div>
        {savedSales.length > 0 ? (
          <Button
            aria-label={t("quickSale.savedSales")}
            className="h-10 px-3 sm:h-8"
            onClick={() => setSavedSalesOpen(true)}
            size="sm"
            variant="outline"
          >
            <AppIcons.documents />
            <span className="hidden sm:inline">{t("quickSale.savedSales")}</span>
            <span className="tabular-nums">{savedSales.length}</span>
          </Button>
        ) : null}
        <LanguageSwitcher />
        <ThemeToggle />
      </header>

      <main className="grid min-h-0 min-w-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_23rem] xl:grid-cols-[minmax(0,1fr)_25rem]">
        <QuickSaleCatalog
          categoriesError={categoriesError}
          categoriesLoading={categoriesLoading}
          categoryId={categoryId}
          categories={categories}
          error={catalogError}
          hasMore={catalogHasMore}
          loading={catalogLoading}
          loadingMore={catalogLoadingMore}
          onAddVariant={addVariant}
          onCategoryChange={setCategoryId}
          onLoadMore={() => void loadCatalog(catalogOffset, true, { categoryId, query })}
          onRetryCategories={() => void loadCategories()}
          onRetryProducts={() => void loadCatalog(0, false, { categoryId, query })}
          products={catalog}
          query={query}
        />
        <QuickSaleCart
          adjustmentReason={adjustmentReason}
          canUpdate={canUpdate}
          cashReceived={cashReceived}
          change={change}
          completedSale={completedSale}
          completing={completing}
          customerEmail={customerEmail}
          customerName={customerName}
          customerPhone={customerPhone}
          discount={discount}
          discountType={discountType}
          discountValue={discountValue}
          lines={lines}
          mobileOpen={mobileCartOpen}
          mobileTriggerRef={mobileCartTriggerRef}
          onClear={clearSale}
          onCloseMobile={() => setMobileCartOpen(false)}
          onComplete={(completion) => void complete(completion)}
          onNewSale={clearSale}
          onSave={() => void saveCart()}
          onSetAdjustmentReason={setAdjustmentReason}
          onSetCashReceived={setCashReceived}
          onSetCustomerEmail={setCustomerEmail}
          onSetCustomerName={setCustomerName}
          onSetCustomerPhone={setCustomerPhone}
          onSetDiscountType={setDiscountType}
          onSetDiscountValue={setDiscountValue}
          onSetReference={setReference}
          onSetStage={setStage}
          onSetTender={setTender}
          onUpdateLine={updateLine}
          productById={productById}
          reference={reference}
          saving={saving}
          stage={stage}
          subtotal={subtotal}
          tender={tender}
          total={total}
          valid={cartValid}
          variantById={variantById}
        />
      </main>

      {lines.length > 0 && !mobileCartOpen ? (
        <div className="shrink-0 border-t bg-background p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden">
          <Button
            className="h-11 w-full justify-between px-4"
            ref={mobileCartTriggerRef}
            onClick={() => setMobileCartOpen(true)}
          >
            <span>
              {t("quickSale.viewCart", {
                count: lines.reduce((sum, line) => sum + line.quantity, 0),
              })}
            </span>
            <AppIcons.arrowRight />
          </Button>
        </div>
      ) : null}

      <SavedSalesSheet
        deletingDraftId={deletingDraftId}
        drafts={savedSales}
        formatDate={formatDate}
        onDelete={(draft) => void deleteSavedSale(draft)}
        onOpenChange={setSavedSalesOpen}
        onRestore={(id) => void restoreDraftById(id)}
        open={savedSalesOpen}
      />
    </div>
  );
}

function SavedSalesSheet({
  deletingDraftId,
  drafts,
  formatDate,
  onDelete,
  onOpenChange,
  onRestore,
  open,
}: {
  deletingDraftId: string | null;
  drafts: MerchantSaleDraftSummary[];
  formatDate: (value: Date | string) => string;
  onDelete: (draft: MerchantSaleDraftSummary) => void;
  onOpenChange: (open: boolean) => void;
  onRestore: (id: string) => void;
  open: boolean;
}) {
  const { t } = useI18n();
  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent className="w-full sm:max-w-md" side="right">
        <SheetHeader>
          <SheetTitle>{t("quickSale.savedSales")}</SheetTitle>
          <SheetDescription>{t("quickSale.savedSalesDescription")}</SheetDescription>
        </SheetHeader>
        <SheetBody className="p-3">
          {drafts.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              {t("quickSale.noSavedSales")}
            </p>
          ) : (
            <div className="divide-y overflow-hidden rounded-xl border">
              {drafts.map((draft) => (
                <div className="flex min-h-16 items-center pr-2" key={draft.id}>
                  <button
                    className="flex min-h-16 min-w-0 flex-1 items-center gap-3 px-3 text-left outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                    onClick={() => onRestore(draft.id)}
                    type="button"
                  >
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                      <AppIcons.orders />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {draft.customerLabel || t("quickSale.walkInCustomer")}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {t("quickSale.items", { count: draft.itemCount })} ·{" "}
                        {formatDate(draft.updatedAt)}
                      </span>
                    </span>
                    <AppIcons.arrowRight className="text-muted-foreground" />
                  </button>
                  <ConfirmDialog
                    confirmLabel={t("quickSale.deleteSavedSale")}
                    description={t("quickSale.deleteSavedSaleDescription")}
                    icon="trash"
                    onConfirm={() => onDelete(draft)}
                    title={t("quickSale.deleteSavedSaleTitle")}
                    trigger={
                      <Button
                        aria-label={t("quickSale.deleteSavedSale")}
                        disabled={deletingDraftId === draft.id}
                        size="icon-sm"
                        variant="ghost"
                      >
                        {deletingDraftId === draft.id ? (
                          <AppIcons.loader className="animate-spin" />
                        ) : (
                          <AppIcons.trash />
                        )}
                      </Button>
                    }
                  />
                </div>
              ))}
            </div>
          )}
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}
