"use client";

import type { MerchantProduct, MerchantProductCollection } from "@ecs/contracts";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import Link from "@/components/app/link";
import { AppIcons } from "@/components/app/icons";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
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
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { slugifyTaxonomyHandle } from "@/features/catalog-taxonomy/taxonomy-table-state";
import {
  ProductCatalogPickerDialog,
  ProductCatalogPickerTrigger,
  type ProductCatalogPickItem,
} from "@/features/products/product-catalog-picker-dialog";
import type { MessageKey } from "@/i18n/messages";
import { useI18n } from "@/i18n/provider";
import { getTenantScopedPath } from "@/lib/dashboard-tenant-context";
import { dashboardRoutes } from "@/lib/routes";

type Translate = (key: MessageKey, values?: Record<string, string | number | Date>) => string;

type CollectionEditSheetProps = {
  collection: MerchantProductCollection | null;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  tenantId?: string | null | undefined;
};

type MemberProduct = {
  id: string;
  title: string | null;
  handle: string | null;
  thumbnail?: string | null;
};

export function CollectionEditSheet({
  collection,
  onOpenChange,
  open,
  tenantId,
}: CollectionEditSheetProps) {
  const { t } = useI18n();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [handle, setHandle] = useState("");
  const [isHandleLocked, setIsHandleLocked] = useState(true);
  const [isVisible, setIsVisible] = useState(true);
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [members, setMembers] = useState<MemberProduct[]>([]);
  const [catalog, setCatalog] = useState<MemberProduct[]>([]);
  const [pendingAddIds, setPendingAddIds] = useState<string[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membershipBusy, setMembershipBusy] = useState(false);
  const HandleLockIcon = isHandleLocked ? AppIcons.lock : AppIcons.lockUnlock;

  const addCandidates = useMemo(() => {
    const memberIds = new Set(members.map((item) => item.id));
    return catalog.filter((item) => !memberIds.has(item.id));
  }, [catalog, members]);

  useEffect(() => {
    if (!collection || !open) return;
    setTitle(collection.title ?? "");
    setHandle(collection.handle ?? "");
    setIsHandleLocked(true);
    setIsVisible(collection.visibility !== "hidden");
    setSeoTitle(collection.seoTitle ?? "");
    setSeoDescription(collection.seoDescription ?? "");
    setError(null);
    setPendingAddIds([]);
    void loadMembership(collection.id);
  }, [collection, open, tenantId]);

  async function loadMembership(collectionId: string) {
    setMembersLoading(true);
    const membersUrl = getTenantScopedPath(
      dashboardRoutes.productCollectionProductsAction(collectionId),
      tenantId,
    );
    const catalogUrl = getTenantScopedPath(dashboardRoutes.productListAction, tenantId);

    const [membersRes, catalogRes] = await Promise.all([
      fetch(membersUrl, { headers: { accept: "application/json" } }).catch(() => null),
      fetch(`${catalogUrl}?limit=100`, { headers: { accept: "application/json" } }).catch(
        () => null,
      ),
    ]);

    const membersData = (await membersRes?.json().catch(() => ({}))) as {
      products?: MerchantProduct[];
      error?: string;
    };
    const catalogData = (await catalogRes?.json().catch(() => ({}))) as {
      products?: MerchantProduct[];
      error?: string;
    };

    setMembers(
      membersRes?.ok && Array.isArray(membersData.products)
        ? membersData.products.map((product) => ({
            id: product.id,
            title: product.title ?? null,
            handle: product.handle ?? null,
            thumbnail: product.thumbnail ?? null,
          }))
        : [],
    );
    setCatalog(
      catalogRes?.ok && Array.isArray(catalogData.products)
        ? catalogData.products.map((product) => ({
            id: product.id,
            title: product.title ?? null,
            handle: product.handle ?? null,
            thumbnail: product.thumbnail ?? null,
          }))
        : [],
    );
    setMembersLoading(false);
  }

  async function mutateMembership(body: { add?: string[]; remove?: string[] }) {
    if (!collection) return;
    setMembershipBusy(true);
    const url = getTenantScopedPath(
      dashboardRoutes.productCollectionProductsAction(collection.id),
      tenantId,
    );
    const response = await fetch(url, {
      body: JSON.stringify(body),
      headers: {
        accept: "application/json",
        "content-type": "application/json",
      },
      method: "POST",
    }).catch(() => null);
    setMembershipBusy(false);

    if (!response?.ok) {
      toast.error(t("taxonomy.edit.membershipFailed"));
      return;
    }

    const added = body.add?.length ?? 0;
    const removed = body.remove?.length ?? 0;
    if (added > 0) {
      toast.success(
        added === 1
          ? t("taxonomy.edit.productAddedOne")
          : t("taxonomy.edit.productsAdded", { count: added }),
      );
    } else if (removed > 0) {
      toast.success(
        removed === 1
          ? t("taxonomy.edit.productRemovedOne")
          : t("taxonomy.edit.productsRemoved", { count: removed }),
      );
    }
    setPendingAddIds([]);
    await loadMembership(collection.id);
    router.refresh();
  }

  async function submit() {
    if (!collection) return;
    const nextTitle = title.trim();
    if (!nextTitle) {
      setError(t("taxonomy.edit.enterCollectionTitle"));
      return;
    }

    setIsSaving(true);
    setError(null);

    const url = getTenantScopedPath(
      dashboardRoutes.productCollectionUpdateAction(collection.id),
      tenantId,
    );
    const response = await fetch(url, {
      body: JSON.stringify({
        title: nextTitle,
        handle: handle.trim() || null,
        visibility: isVisible ? "public" : "hidden",
        seoTitle: seoTitle.trim() || null,
        seoDescription: seoDescription.trim() || null,
      }),
      headers: {
        accept: "application/json",
        "content-type": "application/json",
      },
      method: "POST",
    }).catch(() => null);

    setIsSaving(false);

    if (!response?.ok) {
      const data = (await response?.json().catch(() => ({}))) as { error?: string };
      setError(getCollectionEditErrorMessage(data.error, t));
      return;
    }

    toast.success(t("taxonomy.edit.collectionUpdated"));
    onOpenChange(false);
    await queryClient.invalidateQueries({ queryKey: ["product-collections"] });
    router.refresh();
  }

  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent className="w-full sm:max-w-md" side="right">
        <SheetHeader className="px-5 py-4 text-left">
          <SheetTitle>{t("taxonomy.edit.collectionTitle")}</SheetTitle>
          <SheetDescription>{t("taxonomy.edit.collectionDesc")}</SheetDescription>
        </SheetHeader>

        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <SheetBody className="grid content-start gap-5 px-5 py-5">
            {error ? (
              <Alert variant="destructive">
                <AlertTitle>{t("taxonomy.edit.updateFailedCollection")}</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

            <Field>
              <FieldLabel htmlFor="collection-edit-title">{t("taxonomy.edit.title")}</FieldLabel>
              <Input
                autoComplete="off"
                id="collection-edit-title"
                onChange={(event) => {
                  const next = event.target.value;
                  setTitle(next);
                  if (isHandleLocked) setHandle(slugifyTaxonomyHandle(next));
                }}
                required
                value={title}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="collection-edit-handle">{t("taxonomy.edit.handle")}</FieldLabel>
              <InputGroup className="pr-1">
                <InputGroupInput
                  id="collection-edit-handle"
                  onChange={(event) => setHandle(slugifyTaxonomyHandle(event.target.value))}
                  readOnly={isHandleLocked}
                  value={handle}
                />
                <InputGroupAddon align="inline-end" className="gap-1 py-0 pr-0">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        aria-label={
                          isHandleLocked
                            ? t("taxonomy.form.unlockHandle")
                            : t("taxonomy.form.lockHandle")
                        }
                        className="rounded-full"
                        onClick={() => setIsHandleLocked((value) => !value)}
                        size="icon-sm"
                        type="button"
                        variant="ghost"
                      >
                        <HandleLockIcon data-icon="inline-start" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top" sideOffset={6}>
                      {isHandleLocked
                        ? t("taxonomy.form.unlockHandle")
                        : t("taxonomy.form.lockHandle")}
                    </TooltipContent>
                  </Tooltip>
                </InputGroupAddon>
              </InputGroup>
            </Field>

            <Field className="flex flex-row items-center justify-between gap-4 rounded-xl border px-3.5 py-3">
              <div className="min-w-0 space-y-1">
                <FieldLabel className="text-sm" htmlFor="collection-edit-visible">
                  {t("taxonomy.edit.visibleLabel")}
                </FieldLabel>
                <FieldDescription className="text-xs">
                  {t("taxonomy.edit.visibleCollectionDesc")}
                </FieldDescription>
              </div>
              <Switch
                checked={isVisible}
                id="collection-edit-visible"
                onCheckedChange={setIsVisible}
              />
            </Field>

            <div className="space-y-3 rounded-xl border p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{t("taxonomy.edit.products")}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {t("taxonomy.edit.productsHelp")}
                  </p>
                </div>
                {members.length > 0 ? (
                  <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs tabular-nums text-muted-foreground">
                    {members.length}
                  </span>
                ) : null}
              </div>

              <CollectionProductAddPicker
                candidates={addCandidates}
                disabled={membershipBusy || membersLoading}
                loading={membersLoading}
                onAdd={(ids) => void mutateMembership({ add: ids })}
                onPendingChange={setPendingAddIds}
                pendingIds={pendingAddIds}
              />

              {membersLoading ? (
                <p className="text-xs text-muted-foreground">
                  {t("taxonomy.edit.loadingMembers")}
                </p>
              ) : members.length === 0 ? (
                <div className="rounded-lg border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">
                  <p>{t("taxonomy.edit.noProductsYet")}</p>
                  <Link
                    className="mt-2 inline-block font-medium text-primary hover:underline"
                    href={`${dashboardRoutes.products}?create=product`}
                    prefetch={false}
                  >
                    {t("taxonomy.edit.createProduct")}
                  </Link>
                </div>
              ) : (
                <ul className="max-h-48 divide-y overflow-y-auto rounded-lg border">
                  {members.map((product) => (
                    <li className="flex items-center gap-2 px-3 py-2.5" key={product.id}>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {product.title ?? t("taxonomy.edit.untitledProduct")}
                        </p>
                        {product.handle ? (
                          <p className="truncate text-xs text-muted-foreground">
                            /{product.handle}
                          </p>
                        ) : null}
                      </div>
                      <Button
                        aria-label={t("taxonomy.edit.removeProductAria", {
                          name: product.title ?? t("taxonomy.edit.productFallback"),
                        })}
                        disabled={membershipBusy}
                        onClick={() => void mutateMembership({ remove: [product.id] })}
                        size="icon-sm"
                        type="button"
                        variant="ghost"
                      >
                        <AppIcons.trash data-icon="inline-start" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="space-y-4 rounded-xl border p-4">
              <div>
                <p className="text-sm font-medium">{t("taxonomy.edit.seo")}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {t("taxonomy.edit.seoCollectionHelp")}
                </p>
              </div>
              <Field>
                <FieldLabel htmlFor="collection-edit-seo-title">
                  {t("taxonomy.edit.seoTitle")}
                </FieldLabel>
                <Input
                  id="collection-edit-seo-title"
                  maxLength={120}
                  onChange={(event) => setSeoTitle(event.target.value)}
                  placeholder={t("taxonomy.edit.seoTitleCollectionPlaceholder")}
                  value={seoTitle}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="collection-edit-seo-description">
                  {t("taxonomy.edit.seoDescription")}
                </FieldLabel>
                <Textarea
                  id="collection-edit-seo-description"
                  maxLength={320}
                  onChange={(event) => setSeoDescription(event.target.value)}
                  placeholder={t("taxonomy.edit.seoDescCollectionPlaceholder")}
                  value={seoDescription}
                />
              </Field>
            </div>
          </SheetBody>

          <SheetFooter className="flex-row justify-end gap-2 px-5 py-4">
            <Button
              disabled={isSaving}
              onClick={() => onOpenChange(false)}
              type="button"
              variant="outline"
            >
              {t("common.cancel")}
            </Button>
            <Button disabled={isSaving} type="submit">
              {isSaving ? t("taxonomy.edit.saving") : t("taxonomy.edit.saveChanges")}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function CollectionProductAddPicker({
  candidates,
  disabled,
  loading,
  onAdd,
  onPendingChange,
  pendingIds,
}: {
  candidates: MemberProduct[];
  disabled: boolean;
  loading: boolean;
  onAdd: (ids: string[]) => void;
  onPendingChange: (ids: string[]) => void;
  pendingIds: string[];
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  const items = useMemo<ProductCatalogPickItem[]>(
    () =>
      candidates.map((product) => ({
        id: product.id,
        title: product.title ?? product.handle ?? t("taxonomy.edit.untitledProduct"),
        subtitle: product.handle ? `/${product.handle}` : null,
        thumbnailUrl: product.thumbnail ?? null,
        searchText: [product.title, product.handle, product.id].filter(Boolean).join(" "),
      })),
    [candidates, t],
  );

  return (
    <div className="space-y-2">
      <ProductCatalogPickerTrigger
        disabled={disabled || (!loading && candidates.length === 0 && pendingIds.length === 0)}
        label={
          pendingIds.length === 0
            ? loading
              ? t("taxonomy.edit.loadingProducts")
              : candidates.length === 0
                ? t("taxonomy.edit.noProductsLeft")
                : t("products.catalogPicker.browseCatalog")
            : pendingIds.length === 1
              ? t("taxonomy.edit.productSelectedOne")
              : t("taxonomy.edit.productsSelected", { count: pendingIds.length })
        }
        loading={loading}
        onClick={() => setOpen(true)}
        selectedCount={pendingIds.length}
      />
      <ProductCatalogPickerDialog
        confirmLabel={t("products.catalogPicker.addSelected")}
        description={t("taxonomy.edit.productsHelp")}
        emptyDescription={t("taxonomy.edit.noProductsLeft")}
        emptyTitle={t("taxonomy.edit.noProductsYet")}
        items={items}
        loading={loading}
        onConfirm={(ids) => {
          onPendingChange(ids);
          onAdd(ids);
        }}
        onOpenChange={setOpen}
        open={open}
        searchPlaceholder={t("taxonomy.edit.searchProducts")}
        selectedIds={pendingIds}
        selectionMode="multiple"
        title={t("taxonomy.edit.products")}
      />
    </div>
  );
}

function getCollectionEditErrorMessage(error: string | undefined, t: Translate) {
  if (error === "missing_title") return t("taxonomy.edit.enterCollectionTitle");
  if (error === "commerce_backend_unavailable") {
    return t("taxonomy.edit.backendUnavailable");
  }
  if (error === "commerce_credentials_missing" || error === "commerce_credentials_invalid") {
    return t("taxonomy.edit.credentials");
  }
  if (error === "collection_not_found") return t("taxonomy.edit.collectionNotFound");
  return t("taxonomy.edit.collectionSaveFailed");
}
