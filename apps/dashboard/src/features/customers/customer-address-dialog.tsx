"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { AppIcons } from "@/components/app/icons";
import { UnsavedChangesDialog } from "@/components/app/unsaved-changes-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useUnsavedChangesGuard } from "@/hooks/use-unsaved-changes-guard";
import type { MessageKey } from "@/i18n/messages";
import { useI18n } from "@/i18n/provider";
import type { MerchantCustomerAddress } from "@/lib/merchant-customers";

type Translate = (key: MessageKey, values?: Record<string, string | number | Date>) => string;

export type CustomerAddressFormValues = {
  address1: string;
  address2: string;
  addressName: string;
  city: string;
  company: string;
  countryCode: string;
  firstName: string;
  isDefaultBilling: boolean;
  isDefaultShipping: boolean;
  lastName: string;
  phone: string;
  postalCode: string;
  province: string;
};

const emptyValues: CustomerAddressFormValues = {
  address1: "",
  address2: "",
  addressName: "",
  city: "",
  company: "",
  countryCode: "et",
  firstName: "",
  isDefaultBilling: false,
  isDefaultShipping: false,
  lastName: "",
  phone: "",
  postalCode: "",
  province: "",
};

function fromAddress(address: MerchantCustomerAddress): CustomerAddressFormValues {
  return {
    address1: address.address1 ?? "",
    address2: address.address2 ?? "",
    addressName: address.addressName ?? "",
    city: address.city ?? "",
    company: address.company ?? "",
    countryCode: address.countryCode ?? "et",
    firstName: address.firstName ?? "",
    isDefaultBilling: address.isDefaultBilling,
    isDefaultShipping: address.isDefaultShipping,
    lastName: address.lastName ?? "",
    phone: address.phone ?? "",
    postalCode: address.postalCode ?? "",
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

    const payload = {
      address1: values.address1.trim() || null,
      address2: values.address2.trim() || null,
      addressName: values.addressName.trim() || null,
      city: values.city.trim() || null,
      company: values.company.trim() || null,
      countryCode: values.countryCode.trim().toLowerCase() || "et",
      firstName: values.firstName.trim() || null,
      isDefaultBilling: values.isDefaultBilling,
      isDefaultShipping: values.isDefaultShipping,
      lastName: values.lastName.trim() || null,
      phone: values.phone.trim() || null,
      postalCode: values.postalCode.trim() || null,
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

    toast.success(isEdit ? t("customers.addresses.toastUpdated") : t("customers.addresses.toastAdded"));
    setOpen(false);
    router.refresh();
  }

  return (
    <>
    <Dialog
      onOpenChange={(next) => {
        if (next) setOpen(true);
        else requestClose();
      }}
      open={open}
    >
      {trigger !== undefined ? (
        trigger ? (
          <DialogTrigger asChild>{trigger}</DialogTrigger>
        ) : null
      ) : (
        <DialogTrigger asChild>
          <Button size="sm" type="button" variant={isEdit ? "outline" : "default"}>
            {isEdit ? (
              <>
                <AppIcons.edit data-icon="inline-start" />
                {t("customers.addresses.edit")}
              </>
            ) : (
              <>
                <AppIcons.user data-icon="inline-start" />
                {t("customers.addresses.add")}
              </>
            )}
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="gap-1.5 border-b px-4 py-4 text-left sm:px-5">
          <DialogTitle>{isEdit ? t("customers.addresses.editTitle") : t("customers.addresses.addTitle")}</DialogTitle>
          <DialogDescription>
            {t("customers.addresses.formDesc")}
          </DialogDescription>
        </DialogHeader>
        <div className="grid max-h-[min(70vh,32rem)] gap-4 overflow-y-auto p-4 sm:grid-cols-2 sm:p-5">
          {error ? (
            <Alert className="sm:col-span-2" variant="destructive">
              <AlertTitle>{t("customers.addresses.saveFailedTitle")}</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          <Field>
            <FieldLabel htmlFor={`${id}-name`}>{t("customers.addresses.label")}</FieldLabel>
            <Input
              id={`${id}-name`}
              onChange={(event) => setField("addressName", event.target.value)}
              placeholder={t("customers.addresses.labelPlaceholder")}
              value={values.addressName}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={`${id}-phone`}>{t("customers.addresses.phone")}</FieldLabel>
            <Input
              id={`${id}-phone`}
              onChange={(event) => setField("phone", event.target.value)}
              placeholder="+251…"
              value={values.phone}
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
            <FieldLabel htmlFor={`${id}-company`}>{t("customers.addresses.company")}</FieldLabel>
            <Input
              id={`${id}-company`}
              onChange={(event) => setField("company", event.target.value)}
              value={values.company}
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
            <FieldLabel htmlFor={`${id}-province`}>{t("customers.addresses.province")}</FieldLabel>
            <Input
              id={`${id}-province`}
              onChange={(event) => setField("province", event.target.value)}
              value={values.province}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={`${id}-postal`}>{t("customers.addresses.postalCode")}</FieldLabel>
            <Input
              id={`${id}-postal`}
              onChange={(event) => setField("postalCode", event.target.value)}
              value={values.postalCode}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={`${id}-country`}>{t("customers.addresses.countryCode")}</FieldLabel>
            <Input
              id={`${id}-country`}
              maxLength={2}
              onChange={(event) => setField("countryCode", event.target.value.toLowerCase())}
              placeholder="et"
              value={values.countryCode}
            />
          </Field>
          <div className="flex flex-col gap-3 sm:col-span-2">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={values.isDefaultShipping}
                onCheckedChange={(checked) => setField("isDefaultShipping", Boolean(checked))}
              />
              {t("customers.addresses.defaultShippingLabel")}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={values.isDefaultBilling}
                onCheckedChange={(checked) => setField("isDefaultBilling", Boolean(checked))}
              />
              {t("customers.addresses.defaultBillingLabel")}
            </label>
          </div>
        </div>
        <DialogFooter className="border-t bg-muted/30 px-4 py-3 sm:px-5">
          <Button onClick={requestClose} type="button" variant="outline">
            {t("common.cancel")}
          </Button>
          <Button
            aria-busy={saving}
            disabled={saving}
            onClick={() => void submit()}
            type="button"
          >
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
        </DialogFooter>
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
    router.refresh();
  }

  return (
    <Button
      aria-busy={deleting}
      disabled={deleting}
      onClick={() => void remove()}
      size="sm"
      type="button"
      variant="ghost"
    >
      {deleting ? (
        <AppIcons.loader className="animate-spin" data-icon="inline-start" />
      ) : (
        <AppIcons.trash data-icon="inline-start" />
      )}
      {t("customers.addresses.remove")}
    </Button>
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
