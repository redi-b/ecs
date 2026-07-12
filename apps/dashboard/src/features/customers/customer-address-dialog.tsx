"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { AppIcons } from "@/components/app/icons";
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
import type { MerchantCustomerAddress } from "@/lib/merchant-customers";

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

  function setField<K extends keyof CustomerAddressFormValues>(
    key: K,
    value: CustomerAddressFormValues[K],
  ) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  async function submit() {
    if (saving) return;
    if (!values.address1.trim() && !values.city.trim()) {
      setError("Enter a street address or city.");
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
      setError(getAddressErrorMessage(data.error));
      return;
    }

    toast.success(isEdit ? "Address updated." : "Address added.");
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog onOpenChange={setOpen} open={open}>
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
                Edit
              </>
            ) : (
              <>
                <AppIcons.user data-icon="inline-start" />
                Add address
              </>
            )}
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="gap-1.5 border-b px-4 py-4 text-left sm:px-5">
          <DialogTitle>{isEdit ? "Edit address" : "Add address"}</DialogTitle>
          <DialogDescription>
            Saved addresses are available for manual orders and support.
          </DialogDescription>
        </DialogHeader>
        <div className="grid max-h-[min(70vh,32rem)] gap-4 overflow-y-auto p-4 sm:grid-cols-2 sm:p-5">
          {error ? (
            <Alert className="sm:col-span-2" variant="destructive">
              <AlertTitle>Address could not be saved</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          <Field>
            <FieldLabel htmlFor={`${id}-name`}>Label</FieldLabel>
            <Input
              id={`${id}-name`}
              onChange={(event) => setField("addressName", event.target.value)}
              placeholder="Home, Work…"
              value={values.addressName}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={`${id}-phone`}>Phone</FieldLabel>
            <Input
              id={`${id}-phone`}
              onChange={(event) => setField("phone", event.target.value)}
              placeholder="+251…"
              value={values.phone}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={`${id}-first`}>First name</FieldLabel>
            <Input
              id={`${id}-first`}
              onChange={(event) => setField("firstName", event.target.value)}
              value={values.firstName}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={`${id}-last`}>Last name</FieldLabel>
            <Input
              id={`${id}-last`}
              onChange={(event) => setField("lastName", event.target.value)}
              value={values.lastName}
            />
          </Field>
          <Field className="sm:col-span-2">
            <FieldLabel htmlFor={`${id}-company`}>Company</FieldLabel>
            <Input
              id={`${id}-company`}
              onChange={(event) => setField("company", event.target.value)}
              value={values.company}
            />
          </Field>
          <Field className="sm:col-span-2">
            <FieldLabel htmlFor={`${id}-a1`}>Street address</FieldLabel>
            <Input
              id={`${id}-a1`}
              onChange={(event) => setField("address1", event.target.value)}
              placeholder="Bole Atlas, near …"
              value={values.address1}
            />
          </Field>
          <Field className="sm:col-span-2">
            <FieldLabel htmlFor={`${id}-a2`}>Apartment, floor (optional)</FieldLabel>
            <Input
              id={`${id}-a2`}
              onChange={(event) => setField("address2", event.target.value)}
              value={values.address2}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={`${id}-city`}>City</FieldLabel>
            <Input
              id={`${id}-city`}
              onChange={(event) => setField("city", event.target.value)}
              placeholder="Addis Ababa"
              value={values.city}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={`${id}-province`}>Subcity / province</FieldLabel>
            <Input
              id={`${id}-province`}
              onChange={(event) => setField("province", event.target.value)}
              value={values.province}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={`${id}-postal`}>Postal code</FieldLabel>
            <Input
              id={`${id}-postal`}
              onChange={(event) => setField("postalCode", event.target.value)}
              value={values.postalCode}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={`${id}-country`}>Country code</FieldLabel>
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
              Default shipping address
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={values.isDefaultBilling}
                onCheckedChange={(checked) => setField("isDefaultBilling", Boolean(checked))}
              />
              Default billing address
            </label>
          </div>
        </div>
        <DialogFooter className="border-t bg-muted/30 px-4 py-3 sm:px-5">
          <Button onClick={() => setOpen(false)} type="button" variant="outline">
            Cancel
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
                Saving…
              </>
            ) : isEdit ? (
              "Save address"
            ) : (
              "Add address"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function CustomerAddressDeleteButton({
  addressId,
  customerId,
}: {
  addressId: string;
  customerId: string;
}) {
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
      toast.error("Address could not be removed.");
      return;
    }
    toast.success("Address removed.");
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
      Remove
    </Button>
  );
}

function getAddressErrorMessage(code?: string) {
  switch (code) {
    case "customer_not_found":
      return "Customer was not found.";
    case "customer_address_not_found":
      return "Address was not found.";
    case "invalid_customer_address":
      return "Check the address details and try again.";
    case "commerce_credentials_invalid":
    case "commerce_backend_unavailable":
      return "Customer addresses are temporarily unavailable. Try again.";
    default:
      return "Address could not be saved. Try again.";
  }
}
