"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { AppIcons } from "@/components/app/icons";
import { UnsavedChangesDialog } from "@/components/app/unsaved-changes-dialog";
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
import { useUnsavedChangesGuard } from "@/hooks/use-unsaved-changes-guard";
import type { MessageKey } from "@/i18n/messages";
import { useI18n } from "@/i18n/provider";
import type { MerchantCustomer } from "@/lib/merchant-customers";

export function CustomerFormDialog({
  customer,
  onOpenChange,
  open: openProp,
  trigger,
}: {
  customer?: MerchantCustomer | undefined;
  onOpenChange?: ((open: boolean) => void) | undefined;
  open?: boolean | undefined;
  trigger?: ReactNode;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const id = useId();
  const isControlled = openProp !== undefined;
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = isControlled ? Boolean(openProp) : uncontrolledOpen;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (open) {
      setFormKey((value) => value + 1);
      setError(null);
      setDirty(false);
    }
  }, [open, customer?.id]);

  const { leaveDialogOpen, requestLeave, confirmLeave, cancelLeave } =
    useUnsavedChangesGuard(dirty && open);

  function setOpen(next: boolean) {
    if (!isControlled) setUncontrolledOpen(next);
    onOpenChange?.(next);
  }

  function requestClose() {
    requestLeave(() => setOpen(false));
  }

  async function submit(formData: FormData) {
    setSaving(true);
    setError(null);

    const payload = {
      companyName: String(formData.get("companyName") ?? "").trim() || null,
      email: String(formData.get("email") ?? "").trim(),
      firstName: String(formData.get("firstName") ?? "").trim() || null,
      lastName: String(formData.get("lastName") ?? "").trim() || null,
      phone: String(formData.get("phone") ?? "").trim() || null,
    };

    if (!payload.email) {
      setSaving(false);
      setError(t("customers.detail.enterEmail"));
      return;
    }

    const response = await fetch(
      customer
        ? `/admin/customers/actions/${encodeURIComponent(customer.id)}`
        : "/admin/customers/actions",
      {
        body: JSON.stringify(payload),
        headers: {
          accept: "application/json",
          "content-type": "application/json",
        },
        method: "POST",
      },
    ).catch(() => null);

    setSaving(false);

    if (!response?.ok) {
      const data = (await response?.json().catch(() => ({}))) as { error?: string };
      setError(getCustomerErrorMessage(data.error, Boolean(customer), t));
      return;
    }

    toast.success(customer ? t("customers.detail.toastUpdated") : t("customers.detail.toastCreated"));
    setOpen(false);
    router.refresh();
  }

  const title = customer ? t("customers.detail.editCustomer") : t("customers.detail.addCustomer");

  return (
    <>
    <Dialog
      onOpenChange={(next) => {
        if (!next) requestClose();
        else setOpen(true);
      }}
      open={open}
    >
      {trigger !== undefined ? (
        trigger ? (
          <DialogTrigger asChild>{trigger}</DialogTrigger>
        ) : null
      ) : (
        <DialogTrigger asChild>
          <Button variant={customer ? "outline" : "default"}>
            {customer ? (
              <AppIcons.edit data-icon="inline-start" />
            ) : (
              <AppIcons.user data-icon="inline-start" />
            )}
            {title}
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="gap-1.5 border-b px-4 py-4 text-left sm:px-5">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{t("customers.detail.formDesc")}</DialogDescription>
        </DialogHeader>
        <form
          action={(data) => void submit(data)}
          className="flex flex-col"
          key={formKey}
          onChange={() => setDirty(true)}
        >
          <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
            {error ? (
              <Alert className="sm:col-span-2" variant="destructive">
                <AlertTitle>
                  {customer
                    ? t("customers.detail.updateErrorTitle")
                    : t("customers.detail.createErrorTitle")}
                </AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

            <Field>
              <FieldLabel htmlFor={`${id}-first`}>{t("customers.detail.firstName")}</FieldLabel>
              <Input
                autoComplete="given-name"
                defaultValue={customer?.firstName ?? ""}
                id={`${id}-first`}
                name="firstName"
                placeholder={t("customers.detail.firstNamePlaceholder")}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor={`${id}-last`}>{t("customers.detail.lastName")}</FieldLabel>
              <Input
                autoComplete="family-name"
                defaultValue={customer?.lastName ?? ""}
                id={`${id}-last`}
                name="lastName"
                placeholder={t("customers.detail.lastNamePlaceholder")}
              />
            </Field>
            <Field className="sm:col-span-2">
              <FieldLabel htmlFor={`${id}-email`}>{t("customers.detail.email")}</FieldLabel>
              <Input
                autoComplete="email"
                defaultValue={customer?.email ?? ""}
                id={`${id}-email`}
                name="email"
                placeholder={t("customers.detail.emailPlaceholder")}
                required
                type="email"
              />
              <FieldDescription>{t("customers.detail.emailDesc")}</FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor={`${id}-phone`}>{t("customers.detail.phone")}</FieldLabel>
              <Input
                autoComplete="tel"
                defaultValue={customer?.phone ?? ""}
                id={`${id}-phone`}
                name="phone"
                placeholder={t("customers.detail.phonePlaceholder")}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor={`${id}-company`}>{t("customers.detail.company")}</FieldLabel>
              <Input
                autoComplete="organization"
                defaultValue={customer?.companyName ?? ""}
                id={`${id}-company`}
                name="companyName"
                placeholder={t("customers.detail.companyPlaceholder")}
              />
            </Field>
          </div>
          <DialogFooter className="mx-0 mb-0 rounded-none border-t bg-muted/50 p-4">
            <Button
              disabled={saving}
              onClick={requestClose}
              type="button"
              variant="outline"
            >
              {t("common.cancel")}
            </Button>
            <Button disabled={saving} type="submit">
              {saving
                ? t("common.saving")
                : customer
                  ? t("customers.detail.saveChanges")
                  : t("customers.detail.addCustomer")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
    <UnsavedChangesDialog
      onLeave={confirmLeave}
      onStay={cancelLeave}
      open={leaveDialogOpen}
    />
    </>
  );
}

function getCustomerErrorMessage(
  error: string | undefined,
  isEdit: boolean,
  t: (key: MessageKey) => string,
) {
  if (error === "invalid_customer") return t("customers.detail.error.invalid");
  if (error === "customer_email_conflict") {
    return isEdit
      ? t("customers.detail.error.conflictEdit")
      : t("customers.detail.error.conflictCreate");
  }
  if (error === "customer_not_found") return t("customers.detail.error.notFound");
  if (error === "commerce_backend_unavailable") {
    return isEdit
      ? t("customers.detail.error.unavailableEdit")
      : t("customers.detail.error.unavailableCreate");
  }
  if (error === "commerce_credentials_missing" || error === "commerce_credentials_invalid") {
    return t("customers.detail.error.credentials");
  }
  return isEdit
    ? t("customers.detail.error.fallbackEdit")
    : t("customers.detail.error.fallbackCreate");
}
