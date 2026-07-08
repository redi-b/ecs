"use client";

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
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { slugifyTaxonomyHandle } from "@/features/catalog-taxonomy/taxonomy-table-state";

type TaxonomyCreateDialogProps = {
  action: string;
  entityLabel: "category" | "collection";
  nameKey: "name" | "title";
  nameLabel: string;
  namePlaceholder: string;
  queryKey: string;
  triggerLabel: string;
};

export function TaxonomyCreateDialog({
  action,
  entityLabel,
  nameKey,
  nameLabel,
  namePlaceholder,
  queryKey,
  triggerLabel,
}: TaxonomyCreateDialogProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [handle, setHandle] = useState("");
  const [isHandleLocked, setIsHandleLocked] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const generatedHandle = useMemo(() => slugifyTaxonomyHandle(displayName), [displayName]);
  const HandleLockIcon = isHandleLocked ? AppIcons.lock : AppIcons.lockUnlock;

  function resetForm() {
    setDisplayName("");
    setHandle("");
    setIsHandleLocked(true);
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

    const response = await fetch(action, {
      body: JSON.stringify({
        [nameKey]: trimmedName,
        handle: handle.trim() || null,
      }),
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
    <>
      <Button onClick={() => setOpen(true)} type="button">
        {triggerLabel}
      </Button>
      <Dialog
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);

          if (!nextOpen) {
            resetForm();
          }
        }}
        open={open}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create {entityLabel}</DialogTitle>
            <DialogDescription>
              Create a product {entityLabel}.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void submitTaxonomy();
            }}
          >
            <FieldGroup>
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
                    onChange={(event) =>
                      setHandle(slugifyTaxonomyHandle(event.target.value))
                    }
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
              <DialogFooter>
                <Button disabled={isSaving} onClick={() => setOpen(false)} type="button" variant="outline">
                  Cancel
                </Button>
                <Button disabled={isSaving} type="submit">
                  {isSaving ? "Creating..." : `Create ${entityLabel}`}
                </Button>
              </DialogFooter>
            </FieldGroup>
          </form>
        </DialogContent>
      </Dialog>
    </>
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
