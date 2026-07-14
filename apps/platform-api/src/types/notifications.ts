export type NotificationEventType =
  | "cod_order.created"
  | "chapa.onboarding_needs_review"
  | "domain.misconfigured"
  | "notification.test"
  | "order.created"
  | "order.cancelled"
  | "order.confirmed"
  | "order.delivered"
  | "order.out_for_delivery"
  | "order.ready"
  | "payment.paid"
  | "payment.failed"
  | "payment.webhook_failed"
  | "shop.provisioning_failed"
  | "shop.published"
  | "shop.suspended";

export type NotificationChannel = "email" | "telegram";

export type NotificationPreference = {
  id: string;
  channel: string;
  enabled: boolean;
  events: string[];
  target: string;
  updatedAt: string;
};

export type NotificationPreferenceListResult = {
  ok: true;
  preferences: NotificationPreference[];
};

export type NotificationPreferenceUpsertResult =
  | {
      ok: true;
      preference: NotificationPreference;
    }
  | {
      ok: false;
      error:
        | "notification_channel_invalid"
        | "notification_events_invalid"
        | "notification_target_invalid";
      status: 400;
    };

export type NotificationEventRecordResult = {
  ok: true;
  logCount: number;
  logIds: string[];
};
