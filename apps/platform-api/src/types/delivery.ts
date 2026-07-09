export type DeliverySettings = {
  tenantId: string;
  deliveryEnabled: boolean;
  pickupEnabled: boolean;
  phoneConfirmationRequired: boolean;
  notesEnabled: boolean;
  landmarkRequired: boolean;
  defaultDeliveryFee: string;
  currency: string;
  zones: unknown[];
  updatedAt: string;
};


export type DeliverySettingsResult = {
  ok: true;
  delivery: DeliverySettings;
};


export type DeliverySettingsUpdateResult = DeliverySettingsResult;


