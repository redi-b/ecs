import * as m from "../paraglide/messages.js";

type StorefrontLocale = "en" | "am";

export function orderStatusLabel(status: string, locale: StorefrontLocale) {
  switch (status.trim().toLowerCase()) {
    case "completed":
      return m.account_status_completed({}, { locale });
    case "canceled":
    case "cancelled":
      return m.account_status_canceled({}, { locale });
    case "archived":
      return m.account_status_archived({}, { locale });
    case "draft":
      return m.account_status_draft({}, { locale });
    case "requires_action":
      return m.account_status_action_needed({}, { locale });
    case "pending":
    default:
      return m.account_status_received({}, { locale });
  }
}
