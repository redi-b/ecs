export type CatalogVariant = {
  id: string;
  label: string;
  options: Record<string, string>;
  priceLabel: string | null;
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
