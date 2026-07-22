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

export type CustomerOption = {
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
