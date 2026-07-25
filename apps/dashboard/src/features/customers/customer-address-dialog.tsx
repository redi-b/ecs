"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { AppIcons } from "@/components/app/icons";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { UnsavedChangesDialog } from "@/components/app/unsaved-changes-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useUnsavedChangesGuard } from "@/hooks/use-unsaved-changes-guard";
import type { MessageKey } from "@/i18n/messages";
import { useI18n } from "@/i18n/provider";
import type { MerchantCustomerAddress } from "@/lib/merchant-customers";

type Translate = (key: MessageKey, values?: Record<string, string | number | Date>) => string;

/** Ethiopia-first merchant form — country/postal/billing stay out of the UI. */
export type CustomerAddressFormValues = {
  address1: string;
  address2: string;
  addressName: string;
  city: string;
  company: string;
  firstName: string;
  isDefault: boolean;
  lastName: string;
  phone: string;
  province: string;
};

const emptyValues: CustomerAddressFormValues = {
  address1: "",
  address2: "",
  addressName: "",
  city: "",
  company: "",
  firstName: "",
  isDefault: false,
  lastName: "",
  phone: "",
  province: "",
};

function fromAddress(address: MerchantCustomerAddress): CustomerAddressFormValues {
  return {
    address1: address.address1 ?? "",
    address2: address.address2 ?? "",
    addressName: address.addressName ?? "",
    city: address.city ?? "",
    company: address.company ?? "",
    firstName: address.firstName ?? "",
    // Either Medusa default flag means “default delivery address” for merchants.
    isDefault: address.isDefaultShipping || address.isDefaultBilling,
    lastName: address.lastName ?? "",
    phone: address.phone ?? "",
    province: address.province ?? "",
  };
}

export function CustomerAddressDialog({
  address,
  customerId,
  trigger,
}: {
  address?: MerchantCustomerAddress | undefined;
  customerId: string;
  trigger?: ReactNode;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [values, setValues] = useState(emptyValues);
  const isEdit = Boolean(address);

  useEffect(() => {
    if (!open) return;
    setValues(address ? fromAddress(address) : emptyValues);
    setError(null);
  }, [address, open]);

  const baseline = useMemo(
    () => (address ? fromAddress(address) : emptyValues),
    [address, open],
  );
  const isDirty =
    open &&
    (Object.keys(values) as Array<keyof CustomerAddressFormValues>).some(
      (key) => values[key] !== baseline[key],
    );
  const { leaveDialogOpen, requestLeave, confirmLeave, cancelLeave } =
    useUnsavedChangesGuard(isDirty);

  function requestClose() {
    requestLeave(() => setOpen(false));
  }

  function setField<K extends keyof CustomerAddressFormValues>(
    key: K,
    value: CustomerAddressFormValues[K],
  ) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  async function submit() {
    if (saving) return;
    if (!values.address1.trim() && !values.city.trim()) {
      setError(t("customers.addresses.enterStreetOrCity"));
      return;
    }

    setSaving(true);
    setError(null);

    // Always ET; no postal. Default maps to Medusa shipping flag (billing kept false).
    const payload = {
      address1: values.address1.trim() || null,
      address2: values.address2.trim() || null,
      addressName: values.addressName.trim() || null,
      city: values.city.trim() || null,
      company: values.company.trim() || null,
      countryCode: "et",
      firstName: values.firstName.trim() || null,
      isDefaultBilling: false,
      isDefaultShipping: values.isDefault,
      lastName: values.lastName.trim() || null,
      phone: values.phone.trim() || null,
      postalCode: null,
      province: values.province.trim() || null,
    };

    const url = address
      ? `/admin/customers/actions/${encodeURIComponent(customerId)}/addresses/${encodeURIComponent(address.id)}`
      : `/admin/customers/actions/${encodeURIComponent(customerId)}/addresses`;

    const response = await fetch(url, {
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
      setError(getAddressErrorMessage(data.error, t));
      return;
    }

    toast.success(
      isEdit ? t("customers.addresses.toastUpdated") : t("customers.addresses.toastAdded"),
    );
    setOpen(false);
    router.refresh();
  }

  const title = isEdit ? t("customers.addresses.editTitle") : t("customers.addresses.addTitle");

  return (
    <>
      <Sheet
        onOpenChange={(next) => {
          if (next) setOpen(true);
          else requestClose();
        }}
        open={open}
      >
        {trigger !== undefined ? (
          trigger ? <SheetTrigger asChild>{trigger}</SheetTrigger> : null
        ) : (
          <SheetTrigger asChild>
            <Button size="sm" type="button" variant={isEdit ? "outline" : "default"}>
              {isEdit ? (
                <>
                  <AppIcons.edit data-icon="inline-start" />
                  {t("customers.addresses.edit")}
                </>
              ) : (
                <>
                  <AppIcons.mapPin data-icon="inline-start" />
                  {t("customers.addresses.add")}
                </>
              )}
            </Button>
          </SheetTrigger>
        )}
        <SheetContent className="w-full sm:max-w-md" side="right">
          <SheetHeader className="px-5 py-4 text-left">
            <SheetTitle>{title}</SheetTitle>
            <SheetDescription>{t("customers.addresses.formDesc")}</SheetDescription>
          </SheetHeader>

          <form
            className="flex min-h-0 flex-1 flex-col"
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}
          >
            <SheetBody className="grid content-start gap-4 px-5 py-5 sm:grid-cols-2">
              {error ? (
                <Alert className="sm:col-span-2" variant="destructive">
                  <AlertTitle>{t("customers.addresses.saveFailedTitle")}</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : null}

              <Field className="sm:col-span-2">
                <FieldLabel htmlFor={`${id}-name`}>{t("customers.addresses.label")}</FieldLabel>
                <Input
                  id={`${id}-name`}
                  onChange={(event) => setField("addressName", event.target.value)}
                  placeholder={t("customers.addresses.labelPlaceholder")}
                  value={values.addressName}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor={`${id}-first`}>{t("customers.addresses.firstName")}</FieldLabel>
                <Input
                  id={`${id}-first`}
                  onChange={(event) => setField("firstName", event.target.value)}
                  value={values.firstName}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor={`${id}-last`}>{t("customers.addresses.lastName")}</FieldLabel>
                <Input
                  id={`${id}-last`}
                  onChange={(event) => setField("lastName", event.target.value)}
                  value={values.lastName}
                />
              </Field>
              <Field className="sm:col-span-2">
                <FieldLabel htmlFor={`${id}-phone`}>{t("customers.addresses.phone")}</FieldLabel>
                <Input
                  id={`${id}-phone`}
                  onChange={(event) => setField("phone", event.target.value)}
                  placeholder={t("customers.detail.phonePlaceholder")}
                  value={values.phone}
                />
              </Field>
              <Field className="sm:col-span-2">
                <FieldLabel htmlFor={`${id}-a1`}>{t("customers.addresses.street")}</FieldLabel>
                <Input
                  id={`${id}-a1`}
                  onChange={(event) => setField("address1", event.target.value)}
                  placeholder={t("customers.addresses.streetPlaceholder")}
                  value={values.address1}
                />
              </Field>
              <Field className="sm:col-span-2">
                <FieldLabel htmlFor={`${id}-a2`}>{t("customers.addresses.apartment")}</FieldLabel>
                <Input
                  id={`${id}-a2`}
                  onChange={(event) => setField("address2", event.target.value)}
                  placeholder={t("customers.addresses.apartmentPlaceholder")}
                  value={values.address2}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor={`${id}-city`}>{t("customers.addresses.city")}</FieldLabel>
                <Input
                  id={`${id}-city`}
                  onChange={(event) => setField("city", event.target.value)}
                  placeholder={t("customers.addresses.cityPlaceholder")}
                  value={values.city}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor={`${id}-province`}>
                  {t("customers.addresses.province")}
                </FieldLabel>
                <Input
                  id={`${id}-province`}
                  onChange={(event) => setField("province", event.target.value)}
                  placeholder={t("customers.addresses.provincePlaceholder")}
                  value={values.province}
                />
              </Field>
              <Field className="sm:col-span-2">
                <FieldLabel htmlFor={`${id}-company`}>{t("customers.addresses.company")}</FieldLabel>
                <Input
                  id={`${id}-company`}
                  onChange={(event) => setField("company", event.target.value)}
                  placeholder={t("customers.addresses.companyPlaceholder")}
                  value={values.company}
                />
              </Field>

              <label className="flex items-start gap-2.5 rounded-xl border border-border/70 bg-muted/20 p-3 text-sm leading-snug sm:col-span-2">
                <Checkbox
                  checked={values.isDefault}
                  className="mt-0.5"
                  onCheckedChange={(checked) => setField("isDefault", Boolean(checked))}
                />
                <span>
                  <span className="font-medium">{t("customers.addresses.defaultLabel")}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {t("customers.addresses.defaultHint")}
                  </span>
                </span>
              </label>
            </SheetBody>

            <SheetFooter className="gap-2 border-t bg-muted/40 px-5 py-4 sm:flex-row sm:justify-end">
              <Button
                disabled={saving}
                onClick={requestClose}
                type="button"
                variant="outline"
              >
                {t("common.cancel")}
              </Button>
              <Button aria-busy={saving} disabled={saving} type="submit">
                {saving ? (
                  <>
                    <AppIcons.loader className="animate-spin" data-icon="inline-start" />
                    {t("customers.addresses.saving")}
                  </>
                ) : isEdit ? (
                  t("customers.addresses.saveAddress")
                ) : (
                  t("customers.addresses.add")
                )}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      <UnsavedChangesDialog
        onLeave={confirmLeave}
        onStay={cancelLeave}
        open={leaveDialogOpen}
      />
    </>
  );
}

export function CustomerAddressDeleteButton({
  addressId,
  customerId,
}: {
  addressId: string;
  customerId: string;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [open, setOpen] = useState(false);

  async function remove() {
    if (deleting) return;
    setDeleting(true);
    const response = await fetch(
      `/admin/customers/actions/${encodeURIComponent(customerId)}/addresses/${encodeURIComponent(addressId)}`,
      {
        headers: { accept: "application/json" },
        method: "DELETE",
      },
    ).catch(() => null);
    setDeleting(false);
    if (!response?.ok) {
      toast.error(t("customers.addresses.toastRemoveFailed"));
      return;
    }
    toast.success(t("customers.addresses.toastRemoved"));
    setOpen(false);
    router.refresh();
  }

  return (
    <ConfirmDialog
      confirmDisabled={deleting}
      confirmLabel={
        deleting ? (
          <>
            <AppIcons.loader className="animate-spin" data-icon="inline-start" />
            {t("customers.addresses.removing")}
          </>
        ) : (
          t("customers.addresses.remove")
        )
      }
      description={t("customers.addresses.removeDescription")}
      icon="trash"
      onConfirm={() => void remove()}
      onOpenChange={setOpen}
      open={open}
      title={t("customers.addresses.removeTitle")}
      tone="destructive"
      trigger={
        <Button size="sm" type="button" variant="destructive-outline">
          <AppIcons.trash data-icon="inline-start" />
          {t("customers.addresses.remove")}
        </Button>
      }
    />
  );
}

function getAddressErrorMessage(code: string | undefined, t: Translate) {
  switch (code) {
    case "customer_not_found":
      return t("customers.addresses.errorCustomerNotFound");
    case "customer_address_not_found":
      return t("customers.addresses.errorAddressNotFound");
    case "invalid_customer_address":
      return t("customers.addresses.errorInvalid");
    case "commerce_credentials_invalid":
    case "commerce_backend_unavailable":
      return t("customers.addresses.errorUnavailable");
    default:
      return t("customers.addresses.errorSaveFailed");
  }
}
