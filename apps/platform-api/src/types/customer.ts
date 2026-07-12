export type MerchantCustomerGroup = { id: string; name: string };

export type MerchantCustomerAddress = {
  id: string;
  address1: string | null;
  address2: string | null;
  addressName: string | null;
  city: string | null;
  company: string | null;
  countryCode: string | null;
  firstName: string | null;
  isDefaultBilling: boolean;
  isDefaultShipping: boolean;
  lastName: string | null;
  phone: string | null;
  postalCode: string | null;
  province: string | null;
};

export type MerchantCustomer = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  phone: string | null;
  companyName: string | null;
  groups: MerchantCustomerGroup[];
  addresses: MerchantCustomerAddress[];
  createdAt: string;
  updatedAt: string;
};

export type MerchantCustomerAddressInput = {
  address1?: string | null | undefined;
  address2?: string | null | undefined;
  addressName?: string | null | undefined;
  city?: string | null | undefined;
  company?: string | null | undefined;
  countryCode?: string | null | undefined;
  firstName?: string | null | undefined;
  isDefaultBilling?: boolean | undefined;
  isDefaultShipping?: boolean | undefined;
  lastName?: string | null | undefined;
  phone?: string | null | undefined;
  postalCode?: string | null | undefined;
  province?: string | null | undefined;
};

export type CustomerServiceError = {
  ok: false;
  error:
    | "commerce_backend_unavailable"
    | "commerce_credentials_invalid"
    | "customer_not_found"
    | "customer_email_conflict"
    | "customer_address_not_found"
    | "invalid_customer"
    | "invalid_customer_address";
  status: 400 | 401 | 404 | 409 | 503;
};

export type MerchantCustomersResult =
  | { ok: true; customers: MerchantCustomer[]; count: number; limit: number; offset: number }
  | CustomerServiceError;
export type MerchantCustomerResult =
  | { ok: true; customer: MerchantCustomer }
  | CustomerServiceError;
export type MerchantCustomerGroupsResult =
  | { ok: true; groups: MerchantCustomerGroup[] }
  | CustomerServiceError;
export type MerchantCustomerAddressResult =
  | { ok: true; customer: MerchantCustomer }
  | CustomerServiceError;
