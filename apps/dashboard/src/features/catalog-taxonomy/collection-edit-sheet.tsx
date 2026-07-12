"use client";

import type { MerchantProduct, MerchantProductCollection } from "@ecs/contracts";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { AppIcons } from "@/components/app/icons";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
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
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { slugifyTaxonomyHandle } from "@/features/catalog-taxonomy/taxonomy-table-state";
import { getTenantScopedPath } from "@/lib/dashboard-tenant-context";
import { dashboardRoutes } from "@/lib/routes";

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
  const [selectedAddId, setSelectedAddId] = useState<string>("");
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
    setSelectedAddId("");
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

    toast.success(body.add?.length ? "Product added to collection." : "Product removed.");
    setSelectedAddId("");
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
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-md" side="right">
        <SheetHeader className="border-b px-5 py-4 pr-12 text-left">
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
          <div className="grid flex-1 content-start gap-5 overflow-y-auto px-5 py-5">
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

            <div className="space-y-4 rounded-xl border p-4">
              <div>
                <p className="text-sm font-medium">Products</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Add or remove products in this collection. Changes save immediately.
                </p>
              </div>

              <div className="flex items-end gap-2">
                <Field className="min-w-0 flex-1">
                  <FieldLabel htmlFor="collection-edit-add-product">Add product</FieldLabel>
                  <Select
                    disabled={membershipBusy || membersLoading || addCandidates.length === 0}
                    onValueChange={setSelectedAddId}
                    {...(selectedAddId ? { value: selectedAddId } : {})}
                  >
                    <SelectTrigger className="w-full" id="collection-edit-add-product">
                      <SelectValue
                        placeholder={
                          membersLoading
                            ? "Loading products…"
                            : addCandidates.length === 0
                              ? "No products left to add"
                              : "Select a product"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {addCandidates.map((product) => (
                          <SelectItem key={product.id} value={product.id}>
                            <span className="truncate">
                              {product.title ?? product.handle ?? product.id}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
                <Button
                  disabled={!selectedAddId || membershipBusy}
                  onClick={() => {
                    if (!selectedAddId) return;
                    void mutateMembership({ add: [selectedAddId] });
                  }}
                  type="button"
                >
                  Add
                </Button>
              </div>

              <div className="space-y-2">
                {membersLoading ? (
                  <p className="text-xs text-muted-foreground">Loading members…</p>
                ) : members.length === 0 ? (
                  <p className="rounded-lg border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">
                    No products in this collection yet.
                  </p>
                ) : (
                  <ul className="divide-y overflow-hidden rounded-lg border">
                    {members.map((product) => (
                      <li
                        className="flex items-center gap-2 px-3 py-2.5"
                        key={product.id}
                      >
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
          </div>

          <SheetFooter className="flex-row justify-end gap-2 border-t bg-muted/30 px-5 py-4">
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
