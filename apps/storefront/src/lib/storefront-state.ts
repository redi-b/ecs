import { customerFacingStoreError } from "./commerce/errors.js";
import type { StorefrontLocale } from "@ecs/contracts";
import * as m from "../paraglide/messages.js";

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

export function storefrontState(input: { status: number; message?: string | null; locale?: StorefrontLocale }): StorefrontState {
  const message = input.message?.trim() || "";
  const locale = input.locale ?? "en";
  if (input.status === 404) {
    return {
      actionHref: "/",
      actionLabel: m.status_return_shop({}, { locale }),
      code: "404",
      description: m.status_not_found_help({}, { locale }),
      eyebrow: "Page not found",
      recoveryLabel: "Shop home",
      statusLabel: "No match",
      title: m.status_not_found_title({}, { locale }),
    };
  }
  if (input.status === 401 || input.status === 403) {
    return {
      actionHref: "/account",
      actionLabel: m.action_sign_in({}, { locale }),
      description: m.status_access_help({}, { locale }),
      eyebrow: "Access required",
      recoveryLabel: "Account sign-in",
      statusLabel: "Restricted",
      title: m.status_access_title({}, { locale }),
    };
  }
  if (/shop_unpublished|shop_suspended/i.test(message)) {
    return {
      actionHref: "/",
      actionLabel: m.status_check_again({}, { locale }),
      description: m.status_shop_closed_help({}, { locale }),
      eyebrow: "Shop status",
      recoveryLabel: "Try later",
      statusLabel: "Temporarily closed",
      title: m.status_shop_closed_title({}, { locale }),
    };
  }
  if (input.status === 429) {
    return {
      actionHref: "/",
      actionLabel: m.action_retry({}, { locale }),
      description: m.status_busy_help({}, { locale }),
      eyebrow: "Please wait",
      recoveryLabel: "Retry shortly",
      statusLabel: "Busy",
      title: m.status_busy_title({}, { locale }),
    };
  }
  return {
    actionHref: "/",
    actionLabel: m.action_retry({}, { locale }),
    description: locale === "am" ? m.status_generic_error({}, { locale }) : customerFacingStoreError(message),
    eyebrow: input.status >= 500 ? "Service interrupted" : "Shop unavailable",
    recoveryLabel: "Retry available",
    statusLabel: input.status >= 500 ? "Temporary issue" : "Unavailable",
    title: m.status_loading_failed_title({}, { locale }),
  };
}
