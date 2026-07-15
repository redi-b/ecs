/**
 * Stable provider contract for channel delivery.
 * Future email / Telegram / WhatsApp / push implement this interface only.
 */

export type NotificationChannelId = string;

export type SendNotificationInput = {
  channel: NotificationChannelId;
  tenantId: string;
  /** Opaque target: email address, chat id, phone, push subscription id, etc. */
  recipient: string;
  eventType: string;
  /** Email-oriented; chat/push providers may ignore. */
  subject?: string;
  /** Plain-text body (always present). */
  body: string;
  /**
   * Optional HTML body. Telegram uses a safe subset with parse_mode=HTML;
   * email providers send this as the html part alongside text.
   */
  html?: string;
  /** Non-secret extras for providers (locale, order display id, deep links). */
  metadata?: Record<string, unknown>;
};

export type SendNotificationResult = {
  providerReference?: string;
};

export interface NotificationProvider {
  readonly channel: NotificationChannelId;
  send(input: SendNotificationInput): Promise<SendNotificationResult>;
}
