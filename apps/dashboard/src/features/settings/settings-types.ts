import type {
  DeliverySettings,
  MerchantDashboardAccess,
  StorefrontTemplateCatalogItem,
} from "@ecs/contracts";

export type Delivery = DeliverySettings["delivery"];

export type SettingsWorkspaceProps = {
  delivery: Delivery | null;
  initialTab?: string | undefined;
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
