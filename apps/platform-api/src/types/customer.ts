export type MerchantCustomerGroup = { id: string; name: string };
export type MerchantCustomer = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  phone: string | null;
  companyName: string | null;
  groups: MerchantCustomerGroup[];
  addresses: Array<{
    id: string;
    address1: string | null;
    city: string | null;
    countryCode: string | null;
    isDefaultBilling: boolean;
    isDefaultShipping: boolean;
  }>;
  createdAt: string;
  updatedAt: string;
};
export type CustomerServiceError = {
  ok: false;
  error:
    | "commerce_backend_unavailable"
    | "commerce_credentials_invalid"
    | "customer_not_found"
    | "customer_email_conflict"
    | "invalid_customer";
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
