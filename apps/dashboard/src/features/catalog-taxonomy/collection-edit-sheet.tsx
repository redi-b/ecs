"use client";

import type { MerchantProduct, MerchantProductCollection } from "@ecs/contracts";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
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
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
import { getTenantScopedPath } from "@/lib/dashboard-tenant-context";
import { dashboardRoutes } from "@/lib/routes";
import { cn } from "@/lib/utils";

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
};

export function CollectionEditSheet({
  collection,
  onOpenChange,
  open,
  tenantId,
}: CollectionEditSheetProps) {
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
          }))
        : [],
    );
    setCatalog(
      catalogRes?.ok && Array.isArray(catalogData.products)
        ? catalogData.products.map((product) => ({
            id: product.id,
            title: product.title ?? null,
            handle: product.handle ?? null,
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
      toast.error("Could not update collection products.");
      return;
    }

    const added = body.add?.length ?? 0;
    const removed = body.remove?.length ?? 0;
    if (added > 0) {
      toast.success(added === 1 ? "Product added to collection." : `${added} products added.`);
    } else if (removed > 0) {
      toast.success(removed === 1 ? "Product removed." : `${removed} products removed.`);
    }
    setPendingAddIds([]);
    await loadMembership(collection.id);
    router.refresh();
  }

  async function submit() {
    if (!collection) return;
    const nextTitle = title.trim();
    if (!nextTitle) {
      setError("Enter a collection title.");
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
      setError(getEditErrorMessage(data.error));
      return;
    }

    toast.success("Collection updated.");
    onOpenChange(false);
    await queryClient.invalidateQueries({ queryKey: ["product-collections"] });
    router.refresh();
  }

  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent className="w-full sm:max-w-md" side="right">
        <SheetHeader className="px-5 py-4 text-left">
          <SheetTitle>Edit collection</SheetTitle>
          <SheetDescription>
            Update details, SEO, and which products belong in this collection.
          </SheetDescription>
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
                <AlertTitle>Collection could not be updated</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

            <Field>
              <FieldLabel htmlFor="collection-edit-title">Title</FieldLabel>
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
              <FieldLabel htmlFor="collection-edit-handle">Handle</FieldLabel>
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
                          isHandleLocked ? "Unlock handle editing" : "Lock handle editing"
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
                      {isHandleLocked ? "Unlock handle editing" : "Lock handle editing"}
                    </TooltipContent>
                  </Tooltip>
                </InputGroupAddon>
              </InputGroup>
            </Field>

            <Field className="flex flex-row items-center justify-between gap-4 rounded-xl border px-3.5 py-3">
              <div className="min-w-0 space-y-1">
                <FieldLabel className="text-sm" htmlFor="collection-edit-visible">
                  Visible on storefront
                </FieldLabel>
                <FieldDescription className="text-xs">
                  Hidden collections stay in the dashboard but are not listed publicly.
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
                  <p className="text-sm font-medium">Products</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Search and multi-select products to add. Membership saves immediately.
                  </p>
                </div>
                {members.length > 0 ? (
                  <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs tabular-nums text-muted-foreground">
                    {members.length}
                  </span>
                ) : null}
              </div>

              <ProductAddCombobox
                candidates={addCandidates}
                disabled={membershipBusy || membersLoading}
                loading={membersLoading}
                onAdd={(ids) => void mutateMembership({ add: ids })}
                onPendingChange={setPendingAddIds}
                pendingIds={pendingAddIds}
              />

              {membersLoading ? (
                <p className="text-xs text-muted-foreground">Loading members…</p>
              ) : members.length === 0 ? (
                <p className="rounded-lg border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">
                  No products in this collection yet.
                </p>
              ) : (
                <ul className="max-h-48 divide-y overflow-y-auto rounded-lg border">
                  {members.map((product) => (
                    <li className="flex items-center gap-2 px-3 py-2.5" key={product.id}>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {product.title ?? "Untitled product"}
                        </p>
                        {product.handle ? (
                          <p className="truncate text-xs text-muted-foreground">
                            /{product.handle}
                          </p>
                        ) : null}
                      </div>
                      <Button
                        aria-label={`Remove ${product.title ?? "product"}`}
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
                <p className="text-sm font-medium">SEO</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Optional title and description stored with the collection.
                </p>
              </div>
              <Field>
                <FieldLabel htmlFor="collection-edit-seo-title">SEO title</FieldLabel>
                <Input
                  id="collection-edit-seo-title"
                  maxLength={120}
                  onChange={(event) => setSeoTitle(event.target.value)}
                  placeholder="Summer picks"
                  value={seoTitle}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="collection-edit-seo-description">SEO description</FieldLabel>
                <Textarea
                  id="collection-edit-seo-description"
                  maxLength={320}
                  onChange={(event) => setSeoDescription(event.target.value)}
                  placeholder="Seasonal favorites for your storefront."
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
              Cancel
            </Button>
            <Button disabled={isSaving} type="submit">
              {isSaving ? "Saving…" : "Save changes"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function ProductAddCombobox({
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
  const [open, setOpen] = useState(false);
  const pending = useMemo(() => new Set(pendingIds), [pendingIds]);

  function toggle(id: string) {
    if (pending.has(id)) {
      onPendingChange(pendingIds.filter((item) => item !== id));
      return;
    }
    onPendingChange([...pendingIds, id]);
  }

  const triggerLabel =
    pendingIds.length === 0
      ? loading
        ? "Loading products…"
        : candidates.length === 0
          ? "No products left to add"
          : "Search products to add…"
      : pendingIds.length === 1
        ? "1 product selected"
        : `${pendingIds.length} products selected`;

  return (
    <div className="space-y-2">
      <Popover
        onOpenChange={(next) => {
          setOpen(next);
        }}
        open={open}
      >
        <PopoverTrigger asChild>
          <Button
            aria-expanded={open}
            className={cn(
              "h-8 w-full justify-between px-2.5 font-normal shadow-none",
              pendingIds.length === 0 && "text-muted-foreground",
            )}
            disabled={disabled || (!loading && candidates.length === 0 && pendingIds.length === 0)}
            id="collection-edit-add-product"
            role="combobox"
            type="button"
            variant="outline"
          >
            <span className="truncate">{triggerLabel}</span>
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
                {candidates.map((product) => {
                  const isSelected = pending.has(product.id);
                  const label = product.title ?? product.handle ?? product.id;
                  return (
                    <CommandItem
                      data-checked={isSelected ? true : undefined}
                      key={product.id}
                      onSelect={() => toggle(product.id)}
                      value={`${product.title ?? ""} ${product.handle ?? ""} ${product.id}`}
                    >
                      <Checkbox checked={isSelected} tabIndex={-1} />
                      <span className="min-w-0 flex-1 truncate">{label}</span>
                      {product.handle ? (
                        <span className="ml-auto max-w-[40%] truncate text-xs text-muted-foreground">
                          /{product.handle}
                        </span>
                      ) : null}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
          {pendingIds.length > 0 ? (
            <div className="flex items-center justify-between gap-2 border-t p-2">
              <Button
                onClick={() => onPendingChange([])}
                size="sm"
                type="button"
                variant="ghost"
              >
                Clear
              </Button>
              <Button
                disabled={disabled}
                onClick={() => {
                  onAdd(pendingIds);
                  setOpen(false);
                }}
                size="sm"
                type="button"
              >
                Add {pendingIds.length}
              </Button>
            </div>
          ) : null}
        </PopoverContent>
      </Popover>
    </div>
  );
}

function getEditErrorMessage(error: string | undefined) {
  if (error === "missing_title") return "Enter a collection title.";
  if (error === "commerce_backend_unavailable") {
    return "The commerce backend is temporarily unavailable.";
  }
  if (error === "commerce_credentials_missing" || error === "commerce_credentials_invalid") {
    return "Catalog changes are temporarily unavailable. Contact support.";
  }
  if (error === "collection_not_found") return "Collection was not found.";
  return "Collection could not be saved. Try again.";
}
