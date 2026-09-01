import { customerFacingStoreError } from "./commerce/errors.js";

export type StorefrontState = {
  actionHref: string;
  actionLabel: string;
  code?: "404";
  description: string;
  eyebrow: string;
  recoveryLabel: string;
  statusLabel: string;
  title: string;
};

export function storefrontState(input: { status: number; message?: string | null }): StorefrontState {
  const message = input.message?.trim() || "";
  if (input.status === 404) {
    return {
      actionHref: "/",
      actionLabel: "Return to the shop",
      code: "404",
      description: "This page may have moved, or the address may be incorrect.",
      eyebrow: "Page not found",
      recoveryLabel: "Shop home",
      statusLabel: "No match",
      title: "We could not find this page",
    };
  }
  if (input.status === 401 || input.status === 403) {
    return {
      actionHref: "/account",
      actionLabel: "Sign in",
      description: "Sign in with the account that has access, then try again.",
      eyebrow: "Access required",
      recoveryLabel: "Account sign-in",
      statusLabel: "Restricted",
      title: "This page is not available to you",
    };
  }
  if (/shop_unpublished|shop_suspended/i.test(message)) {
    return {
      actionHref: "/",
      actionLabel: "Check again",
      description: customerFacingStoreError(message),
      eyebrow: "Shop status",
      recoveryLabel: "Try later",
      statusLabel: "Temporarily closed",
      title: "This shop is not open right now",
    };
  }
  if (input.status === 429) {
    return {
      actionHref: "/",
      actionLabel: "Try again",
      description: "Too many requests reached the shop at once. Wait a moment, then try again.",
      eyebrow: "Please wait",
      recoveryLabel: "Retry shortly",
      statusLabel: "Busy",
      title: "The shop needs a moment",
    };
  }
  return {
    actionHref: "/",
    actionLabel: "Try again",
    description: customerFacingStoreError(message),
    eyebrow: input.status >= 500 ? "Service interrupted" : "Shop unavailable",
    recoveryLabel: "Retry available",
    statusLabel: input.status >= 500 ? "Temporary issue" : "Unavailable",
    title: "The shop could not finish loading",
  };
}
