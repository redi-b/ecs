export type {
  NotificationPreference,
  NotificationPreferenceUpsertResult,
  NotificationPreferencesResult,
  NotificationTestResult,
} from "@/lib/platform-api/notifications/client";
export {
  listMerchantNotificationPreferences,
  sendMerchantNotificationTest,
  upsertMerchantNotificationPreference,
} from "@/lib/platform-api/notifications/client";
