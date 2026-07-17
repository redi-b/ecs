import type {
  DeliverySettings,
  MerchantDashboardAccess,
  StorefrontTemplateCatalogItem,
} from "@ecs/contracts";

import type { MessageKey } from "@/i18n/messages";
import type { MerchantPaymentsStatus } from "@/lib/platform-api/payments/client";

export type Delivery = DeliverySettings["delivery"];

export type SettingsWorkspaceProps = {
  delivery: Delivery | null;
  initialTab?: string | undefined;
  payments: MerchantPaymentsStatus | null;
  /** mailto: or https — merchant support for Chapa setup help. */
  paymentsSupportHref?: string | null | undefined;
  settingsStatus?: string | undefined;
  storefrontTemplates: StorefrontTemplateCatalogItem[];
  /** Access shell only — settings never needs ops/metrics/billing. */
  summary: MerchantDashboardAccess;
  templateStatus?: string | undefined;
};

export type DeliveryKey =
  | "deliveryEnabled"
  | "landmarkRequired"
  | "notesEnabled"
  | "phoneConfirmationRequired"
  | "pickupEnabled";

export const deliveryFieldKeys: Array<{
  descriptionKey: MessageKey;
  key: DeliveryKey;
  labelKey: MessageKey;
}> = [
  {
    key: "deliveryEnabled",
    labelKey: "settings.fulfillment.delivery.label",
    descriptionKey: "settings.fulfillment.delivery.description",
  },
  {
    key: "pickupEnabled",
    labelKey: "settings.fulfillment.pickup.label",
    descriptionKey: "settings.fulfillment.pickup.description",
  },
  {
    key: "phoneConfirmationRequired",
    labelKey: "settings.fulfillment.phoneConfirmation.label",
    descriptionKey: "settings.fulfillment.phoneConfirmation.description",
  },
  {
    key: "landmarkRequired",
    labelKey: "settings.fulfillment.landmark.label",
    descriptionKey: "settings.fulfillment.landmark.description",
  },
  {
    key: "notesEnabled",
    labelKey: "settings.fulfillment.notes.label",
    descriptionKey: "settings.fulfillment.notes.description",
  },
];

/** @deprecated Prefer deliveryFieldKeys + i18n in the UI. */
export const deliveryLabels: Array<{
  description: string;
  key: DeliveryKey;
  label: string;
}> = [
  {
    key: "deliveryEnabled",
    label: "Delivery",
    description: "Allow customers to choose local delivery.",
  },
  {
    key: "pickupEnabled",
    label: "Pickup",
    description: "Allow customers to collect orders.",
  },
  {
    key: "phoneConfirmationRequired",
    label: "Phone confirmation",
    description: "Require a phone number before checkout.",
  },
  {
    key: "landmarkRequired",
    label: "Delivery landmark",
    description: "Require a nearby landmark for delivery.",
  },
  {
    key: "notesEnabled",
    label: "Delivery notes",
    description: "Let customers add delivery instructions.",
  },
];
