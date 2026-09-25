export type CatalogVariant = {
  id: string;
  label: string;
  options: Record<string, string>;
  optionSwatches: Record<string, string>;
  priceLabel: string | null;
  priceAmount: number | null;
  currencyCode: string;
  productId: string;
  productTitle: string;
  sku: string | null;
  thumbnailUrl: string | null;
  variantTitle: string;
  /** Available units when inventory is tracked; null = not tracked. */
  availableQuantity: number | null;
};
export type CustomerAddressOption = {
  address1: string | null;
  city: string | null;
  firstName: string | null;
  id: string;
  isDefault: boolean;
  label: string;
  lastName: string | null;
  phone: string | null;
  province: string | null;
};

export type CustomerOption = {
  addresses: CustomerAddressOption[];
  email: string;
  firstName: string | null;
  id: string;
  label: string;
  lastName: string | null;
  phone: string | null;
};

export type LineItem = {
  quantity: number;
  unitPrice: number | null;
  variantId: string;
};

export type AddressForm = {
  address1: string;
  city: string;
  firstName: string;
  lastName: string;
  phone: string;
  province: string;
};

export const emptyAddress: AddressForm = {
  address1: "",
  city: "",
  firstName: "",
  lastName: "",
  phone: "",
  province: "",
};

/** Combobox value for typing a one-off address on the order (not a saved book entry). */
export const MANUAL_ADDRESS_NEW = "__new__";

export function formatCustomerAddressLabel(address: {
  address1?: string | null;
  addressName?: string | null;
  city?: string | null;
  isDefault?: boolean;
  province?: string | null;
  fallback?: string;
}): string {
  const primary =
    address.addressName?.trim() ||
    [address.address1, address.city, address.province].filter(Boolean).join(", ") ||
    address.fallback ||
    "Address";
  return address.isDefault ? `${primary}` : primary;
}

export function addressFormFromSaved(
  address: CustomerAddressOption,
  fallback: { firstName?: string | null; lastName?: string | null; phone?: string | null } = {},
): AddressForm {
  return {
    address1: address.address1 ?? "",
    city: address.city ?? "",
    firstName: address.firstName ?? fallback.firstName ?? "",
    lastName: address.lastName ?? fallback.lastName ?? "",
    phone: address.phone ?? fallback.phone ?? "",
    province: address.province ?? "",
  };
}

export function formatPrice(amount: number, currencyCode: string) {
  try {
    return new Intl.NumberFormat("en-ET", {
      currency: currencyCode.toUpperCase(),
      maximumFractionDigits: 2,
      style: "currency",
    }).format(amount);
  } catch {
    return `${amount} ${currencyCode.toUpperCase()}`;
  }
}

export type ManualOrderDiscountType = "none" | "fixed" | "percentage";
export type ManualOrderCustomerMode = "existing" | "new";

export type ManualOrderDraft = {
  address: AddressForm;
  adjustmentReason: string;
  customerEmail: string;
  customerFirstName: string;
  customerId: string | null;
  customerLastName: string;
  customerMode: ManualOrderCustomerMode;
  customerPhone: string;
  discountType: ManualOrderDiscountType;
  discountValue: string;
  includeAddress: boolean;
  lines: LineItem[];
  note: string;
  savedAddressId: string;
};

export function canContinueFromManualOrderCustomer(
  draft: Pick<ManualOrderDraft, "customerId" | "customerMode" | "customerPhone">,
) {
  return draft.customerMode === "existing"
    ? Boolean(draft.customerId)
    : draft.customerPhone.replace(/\D/g, "").length >= 8;
}

export function canContinueFromManualOrderItems(lines: LineItem[]) {
  return lines.length > 0 && lines.every((line) => line.quantity > 0);
}

export function isManualOrderDraftDirty(draft: ManualOrderDraft) {
  if (draft.customerMode === "existing" && draft.customerId) return true;
  if (
    draft.customerMode === "new" &&
    (draft.customerEmail.trim() ||
      draft.customerFirstName.trim() ||
      draft.customerLastName.trim() ||
      draft.customerPhone.trim())
  ) {
    return true;
  }
  if (draft.lines.length > 0) return true;
  if (
    draft.discountType !== "none" ||
    draft.discountValue ||
    draft.adjustmentReason.trim() ||
    draft.note.trim() ||
    !draft.includeAddress ||
    draft.savedAddressId !== MANUAL_ADDRESS_NEW
  ) {
    return true;
  }

  return (Object.keys(emptyAddress) as Array<keyof AddressForm>).some(
    (key) => draft.address[key] !== emptyAddress[key],
  );
}

export function calculateManualOrderPricing(
  lines: LineItem[],
  variants: ReadonlyMap<string, CatalogVariant>,
  discountType: ManualOrderDiscountType,
  discountValue: string,
  adjustmentReason: string,
) {
  const merchandiseSubtotal = lines.reduce((sum, line) => {
    const variant = variants.get(line.variantId);
    return sum + (line.unitPrice ?? variant?.priceAmount ?? 0) * line.quantity;
  }, 0);
  const parsedDiscountValue = Number(discountValue);
  const discountAmount =
    discountType === "percentage"
      ? merchandiseSubtotal * (Number.isFinite(parsedDiscountValue) ? parsedDiscountValue / 100 : 0)
      : discountType === "fixed" && Number.isFinite(parsedDiscountValue)
        ? parsedDiscountValue
        : 0;
  const hasPriceAdjustment =
    lines.some((line) => line.unitPrice !== null) || discountType !== "none";
  const adjustmentIsValid =
    !hasPriceAdjustment ||
    (adjustmentReason.trim().length >= 3 &&
      (discountType === "none" ||
        (Number.isFinite(parsedDiscountValue) && parsedDiscountValue > 0)) &&
      discountAmount >= 0 &&
      discountAmount <= merchandiseSubtotal &&
      (discountType !== "percentage" || parsedDiscountValue <= 100));

  return {
    adjustmentIsValid,
    discountAmount,
    hasPriceAdjustment,
    merchandiseSubtotal,
    parsedDiscountValue,
  };
}

export function buildManualOrderPayload(
  draft: ManualOrderDraft,
  pricing: Pick<
    ReturnType<typeof calculateManualOrderPricing>,
    "hasPriceAdjustment" | "parsedDiscountValue"
  >,
) {
  return {
    customerEmail: draft.customerEmail.trim().toLowerCase() || null,
    customerFirstName: draft.customerFirstName.trim() || null,
    customerId: draft.customerMode === "existing" ? draft.customerId : null,
    customerLastName: draft.customerLastName.trim() || null,
    customerPhone: draft.customerPhone.trim() || null,
    items: draft.lines.map((line) => ({
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      variantId: line.variantId,
    })),
    discount:
      draft.discountType === "none"
        ? null
        : { type: draft.discountType, value: pricing.parsedDiscountValue },
    adjustmentReason: pricing.hasPriceAdjustment ? draft.adjustmentReason.trim() : null,
    note: draft.note.trim() || null,
    shippingAddress: draft.includeAddress
      ? {
          address1: draft.address.address1.trim() || null,
          city: draft.address.city.trim() || null,
          countryCode: "et",
          firstName: draft.address.firstName.trim() || draft.customerFirstName.trim() || null,
          lastName: draft.address.lastName.trim() || draft.customerLastName.trim() || null,
          phone: draft.address.phone.trim() || draft.customerPhone.trim() || null,
          province: draft.address.province.trim() || null,
        }
      : null,
  };
}
