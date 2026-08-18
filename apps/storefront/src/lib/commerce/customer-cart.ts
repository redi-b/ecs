import { getCustomerTokenFromRequest } from "../session/customer-cookie.js";
import { transferStoreCartToCustomer } from "./account.js";
import type { HostedStoreRequest } from "./types.js";

type CustomerCartContext = HostedStoreRequest & {
  cartId: string;
};

export type CustomerCartAssociation =
  | { ok: true; authenticated: boolean }
  | { ok: false; message: string };

/**
 * Establishes the explicit Medusa cart/customer relationship used by checkout.
 * It never discovers or claims carts by email/phone and is a no-op for guests.
 */
export async function associateCartWithCustomer(
  context: CustomerCartContext & { token: string | null },
): Promise<CustomerCartAssociation> {
  if (!context.token) return { ok: true, authenticated: false };

  const result = await transferStoreCartToCustomer({
    ...context,
    token: context.token,
  });

  return result === true
    ? { ok: true, authenticated: true }
    : {
        ok: false,
        message: "We could not connect this cart to your account. Your cart is safe; sign in again and retry.",
      };
}

export function associateRequestCartWithCustomer(
  request: Request,
  context: CustomerCartContext,
) {
  return associateCartWithCustomer({
    ...context,
    token: getCustomerTokenFromRequest(request),
  });
}
