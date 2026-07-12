"use client";

import type { MerchantProductCategory } from "@ecs/contracts";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

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
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  getCategoryDisplayName,
  slugifyTaxonomyHandle,
} from "@/features/catalog-taxonomy/taxonomy-table-state";

type TaxonomyCreateDialogProps = {
  action: string;
  entityLabel: "category" | "collection";
  nameKey: "name" | "title";
  nameLabel: string;
  namePlaceholder: string;
  /** Existing categories for parent selection (category create only). */
  parentOptions?: MerchantProductCategory[];
  queryKey: string;
  triggerLabel: string;
};

export function TaxonomyCreateDialog({
  action,
  entityLabel,
  nameKey,
  nameLabel,
  namePlaceholder,
  parentOptions = [],
  queryKey,
  triggerLabel,
}: TaxonomyCreateDialogProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [handle, setHandle] = useState("");
  const [isHandleLocked, setIsHandleLocked] = useState(true);
  const [parentCategoryId, setParentCategoryId] = useState<string>("__root__");
  const [isVisible, setIsVisible] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const generatedHandle = useMemo(() => slugifyTaxonomyHandle(displayName), [displayName]);
  const HandleLockIcon = isHandleLocked ? AppIcons.lock : AppIcons.lockUnlock;

  const sortedParents = useMemo(
    () =>
      [...parentOptions].sort((a, b) =>
        getCategoryDisplayName(a).localeCompare(getCategoryDisplayName(b)),
      ),
    [parentOptions],
  );

  function resetForm() {
    setDisplayName("");
    setHandle("");
    setIsHandleLocked(true);
    setParentCategoryId("__root__");
    setIsVisible(true);
    setError(null);
  }

  function updateDisplayName(nextName: string) {
    setDisplayName(nextName);

    if (isHandleLocked) {
      setHandle(slugifyTaxonomyHandle(nextName));
    }
  }

  function regenerateHandle() {
    setHandle(generatedHandle);
    setIsHandleLocked(true);
  }

  async function submitTaxonomy() {
    const trimmedName = displayName.trim();

    if (!trimmedName) {
      setError(`Enter a ${entityLabel} ${nameLabel.toLowerCase()}.`);
      return;
    }

    setIsSaving(true);
    setError(null);

    const payload: Record<string, string | null> = {
      [nameKey]: trimmedName,
      handle: handle.trim() || null,
    };

    if (entityLabel === "category") {
      payload.parentCategoryId =
        parentCategoryId && parentCategoryId !== "__root__" ? parentCategoryId : null;
      payload.visibility = isVisible ? "public" : "hidden";
    }

    if (entityLabel === "collection") {
      payload.visibility = isVisible ? "public" : "hidden";
    }

    const response = await fetch(action, {
      body: JSON.stringify(payload),
      headers: {
        accept: "application/json",
        "content-type": "application/json",
      },
      method: "POST",
    }).catch(() => null);
    const data = (await response?.json().catch(() => ({}))) as { error?: string };

    setIsSaving(false);

    if (!response?.ok) {
      setError(getTaxonomyCreateErrorMessage(entityLabel, data.error));
      return;
    }

    toast.success(`${capitalize(entityLabel)} created.`);
    setOpen(false);
    resetForm();
    await queryClient.invalidateQueries({ queryKey: [queryKey] });
    router.refresh();
  }

  return (
    <Dialog
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) resetForm();
      }}
      open={open}
    >
      <DialogTrigger asChild>
        <Button type="button">
          {entityLabel === "category" ? (
            <AppIcons.tree data-icon="inline-start" />
          ) : (
            <AppIcons.folder data-icon="inline-start" />
          )}
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="gap-1.5 border-b px-4 py-4 text-left sm:px-5">
          <DialogTitle>Create {entityLabel}</DialogTitle>
          <DialogDescription>
            {entityLabel === "category"
              ? "Add a category with an optional parent and storefront visibility."
              : "Add a collection name, handle, and storefront visibility."}
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col"
          onSubmit={(event) => {
            event.preventDefault();
            void submitTaxonomy();
          }}
        >
          <div className="grid gap-4 p-4 sm:p-5">
            {error ? (
              <Alert variant="destructive">
                <AlertTitle>{capitalize(entityLabel)} could not be created</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
            <Field>
              <FieldLabel htmlFor={`taxonomy-${entityLabel}-name`}>{nameLabel}</FieldLabel>
              <Input
                autoComplete="off"
                id={`taxonomy-${entityLabel}-name`}
                onChange={(event) => updateDisplayName(event.target.value)}
                placeholder={namePlaceholder}
                required
                value={displayName}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor={`taxonomy-${entityLabel}-handle`}>Handle</FieldLabel>
              <InputGroup className="pr-1">
                <InputGroupInput
                  id={`taxonomy-${entityLabel}-handle`}
                  onChange={(event) => setHandle(slugifyTaxonomyHandle(event.target.value))}
                  placeholder={slugifyTaxonomyHandle(namePlaceholder)}
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
                        onClick={() => setIsHandleLocked((current) => !current)}
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
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        aria-label={`Regenerate ${entityLabel} handle`}
                        className="rounded-full"
                        onClick={regenerateHandle}
                        size="icon-sm"
                        type="button"
                        variant="ghost"
                      >
                        <AppIcons.refresh data-icon="inline-start" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top" sideOffset={6}>
                      Regenerate from {nameLabel.toLowerCase()}
                    </TooltipContent>
                  </Tooltip>
                </InputGroupAddon>
              </InputGroup>
              <FieldDescription>
                {isHandleLocked
                  ? `The ${entityLabel} handle follows the ${nameLabel.toLowerCase()} automatically.`
                  : `Handle editing is unlocked for a custom ${entityLabel} slug.`}
              </FieldDescription>
            </Field>

            {entityLabel === "category" ? (
              <Field>
                <FieldLabel>Parent category</FieldLabel>
                <Select onValueChange={setParentCategoryId} value={parentCategoryId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Root category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="__root__">Root category</SelectItem>
                      {sortedParents.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {getCategoryDisplayName(category)}
                          {category.handle ? (
                            <span className="ml-2 text-muted-foreground">/{category.handle}</span>
                          ) : null}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <FieldDescription>
                  Nest under another category, or leave as a top-level root.
                </FieldDescription>
              </Field>
            ) : null}

            <Field className="flex flex-row items-center justify-between gap-4 rounded-xl border px-3.5 py-3">
              <div className="min-w-0 space-y-1">
                <FieldLabel className="text-sm" htmlFor={`taxonomy-${entityLabel}-visible`}>
                  Visible on storefront
                </FieldLabel>
                <FieldDescription className="text-xs">
                  Hidden {entityLabel === "category" ? "categories" : "collections"} stay in the
                  dashboard but are not listed publicly.
                </FieldDescription>
              </div>
              <Switch
                checked={isVisible}
                id={`taxonomy-${entityLabel}-visible`}
                onCheckedChange={setIsVisible}
              />
            </Field>
          </div>
          <DialogFooter className="mx-0 mb-0 rounded-none border-t bg-muted/50 p-4 sm:justify-end">
            <Button
              disabled={isSaving}
              onClick={() => setOpen(false)}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button disabled={isSaving} type="submit">
              {isSaving ? "Creating…" : `Create ${entityLabel}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function getTaxonomyCreateErrorMessage(
  entityLabel: "category" | "collection",
  error: string | undefined,
) {
  if (error === "missing_name" || error === "missing_title") {
    return `Enter a ${entityLabel} name before continuing.`;
  }

  if (error === "commerce_backend_unavailable") {
    return "The commerce backend is temporarily unavailable.";
  }

  if (error === "commerce_credentials_missing" || error === "commerce_credentials_invalid") {
    return "Catalog changes are temporarily unavailable. Contact support.";
  }

  return `${capitalize(entityLabel)} could not be saved. Try again.`;
}

function capitalize(value: string) {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}
