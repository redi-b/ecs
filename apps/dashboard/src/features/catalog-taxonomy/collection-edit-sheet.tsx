"use client";

import type { MerchantProductCollection } from "@ecs/contracts";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AppIcons } from "@/components/app/icons";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
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
  const HandleLockIcon = isHandleLocked ? AppIcons.lock : AppIcons.lockUnlock;

  useEffect(() => {
    if (!collection || !open) return;
    setTitle(collection.title ?? "");
    setHandle(collection.handle ?? "");
    setIsHandleLocked(true);
    setIsVisible(collection.visibility !== "hidden");
    setSeoTitle(collection.seoTitle ?? "");
    setSeoDescription(collection.seoDescription ?? "");
    setError(null);
  }, [collection, open]);

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
            Update title, handle, storefront visibility, and SEO fields.
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
