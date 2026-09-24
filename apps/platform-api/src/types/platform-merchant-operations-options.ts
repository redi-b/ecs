import type {
  MerchantOrderAction,
  MerchantOrderActionResult,
  MerchantOrderDetailResult,
  MerchantOrdersResult,
} from "./merchant-order.js";
import type {
  NotificationEventRecordResult,
  NotificationEventType,
  NotificationPreferenceListResult,
  NotificationPreferenceUpsertResult,
} from "./notifications.js";

export type PlatformMerchantOperationsOptions = {
  listMerchantOrders?:
    | ((
        input: import("./merchant-order.js").MerchantOrderListQuery,
      ) => Promise<MerchantOrdersResult>)
    | undefined;
  recordMerchantDataExport?:
    | ((input: {
        actorUserId: string;
        exportType: "orders" | "customers";
        rowCount: number;
        schemaVersion: string;
        tenantId: string;
      }) => Promise<void>)
    | undefined;
  getMerchantOrder?:
    | ((input: { orderId: string; salesChannelId: string }) => Promise<MerchantOrderDetailResult>)
    | undefined;
  createMerchantManualOrder?:
    | ((input: {
        customerEmail: string;
        customerId?: string | null | undefined;
        customerFirstName?: string | null | undefined;
        customerLastName?: string | null | undefined;
        customerPhone?: string | null | undefined;
        items: Array<{
          quantity: number;
          unitPrice?: number | null | undefined;
          variantId: string;
        }>;
        discount?: { type: "fixed" | "percentage"; value: number } | null | undefined;
        adjustmentReason?: string | null | undefined;
        note?: string | null | undefined;
        regionId: string;
        salesChannelId: string;
        shippingAddress?:
          | {
              address1?: string | null | undefined;
              address2?: string | null | undefined;
              city?: string | null | undefined;
              countryCode?: string | null | undefined;
              firstName?: string | null | undefined;
              lastName?: string | null | undefined;
              phone?: string | null | undefined;
              postalCode?: string | null | undefined;
              province?: string | null | undefined;
            }
          | null
          | undefined;
        shippingOptionId?: string | null | undefined;
        tenantId: string;
        userId: string;
      }) => Promise<
        | {
            ok: true;
            order: {
              id: string;
              displayId: string | number | null;
              status: string;
            };
          }
        | {
            ok: false;
            error: string;
            status: 400 | 401 | 404 | 502 | 503;
          }
      >)
    | undefined;
  mutateMerchantOrder?:
    | ((input: {
        action: MerchantOrderAction;
        fulfillmentId?: string | undefined;
        markPaid?: boolean | undefined;
        orderId: string;
        salesChannelId: string;
        shippingOptionId?: string | undefined;
        stockLocationId?: string | undefined;
        paymentReference?: string | null | undefined;
        source?: "dashboard" | "chapa_webhook" | "chapa_recheck" | "telegram" | undefined;
        settlement?:
          | {
              method: "cash" | "telebirr" | "cbe_birr" | "bank_transfer" | "chapa" | "other";
              bankCode?: string | null | undefined;
              bankName?: string | null | undefined;
              accountLast4?: string | null | undefined;
              accountLabel?: string | null | undefined;
              receivingAccountId?: string | null | undefined;
              reference?: string | null | undefined;
              note?: string | null | undefined;
            }
          | null
          | undefined;
        refund?:
          | {
              amount: number;
              method: "cash" | "telebirr" | "cbe_birr" | "bank_transfer" | "chapa" | "other";
              reason:
                | "customer_request"
                | "item_unavailable"
                | "wrong_item"
                | "damaged_item"
                | "duplicate_payment"
                | "other";
              reference?: string | null | undefined;
              note?: string | null | undefined;
            }
          | undefined;
      }) => Promise<MerchantOrderActionResult>)
    | undefined;
  updateMerchantOrderSettlement?:
    | ((input: {
        orderId: string;
        salesChannelId: string;
        settlement: {
          method: "cash" | "telebirr" | "cbe_birr" | "bank_transfer" | "chapa" | "other";
          bankCode?: string | null | undefined;
          bankName?: string | null | undefined;
          accountLast4?: string | null | undefined;
          accountLabel?: string | null | undefined;
          receivingAccountId?: string | null | undefined;
          reference?: string | null | undefined;
          note?: string | null | undefined;
        };
      }) => Promise<MerchantOrderActionResult>)
    | undefined;
  listMerchantReceivingAccounts?:
    | ((input: { tenantId: string; includeInactive?: boolean }) => Promise<{
        ok: true;
        accounts: Array<{
          id: string;
          bankCode: string | null;
          bankName: string;
          accountName: string | null;
          accountLast4: string | null;
          label: string;
          isDefault: boolean;
          isActive: boolean;
          createdAt: string;
          updatedAt: string;
        }>;
      }>)
    | undefined;
  createMerchantReceivingAccount?:
    | ((input: {
        tenantId: string;
        bankCode?: string | null;
        bankName: string;
        accountName?: string | null;
        accountNumber?: string | null;
        label: string;
        isDefault?: boolean;
      }) => Promise<
        | {
            ok: true;
            account: {
              id: string;
              bankCode: string | null;
              bankName: string;
              accountName: string | null;
              accountLast4: string | null;
              label: string;
              isDefault: boolean;
              isActive: boolean;
              createdAt: string;
              updatedAt: string;
            };
          }
        | { ok: false; error: string; status: 400 | 409 | 503 }
      >)
    | undefined;
  updateMerchantReceivingAccount?:
    | ((input: {
        tenantId: string;
        accountId: string;
        bankCode?: string | null;
        bankName?: string;
        accountName?: string | null;
        accountNumber?: string | null;
        label?: string;
        isDefault?: boolean;
        isActive?: boolean;
      }) => Promise<
        | {
            ok: true;
            account: {
              id: string;
              bankCode: string | null;
              bankName: string;
              accountName: string | null;
              accountLast4: string | null;
              label: string;
              isDefault: boolean;
              isActive: boolean;
              createdAt: string;
              updatedAt: string;
            };
          }
        | { ok: false; error: string; status: 400 | 404 | 409 | 503 }
      >)
    | undefined;
  deleteMerchantReceivingAccount?:
    | ((input: {
        tenantId: string;
        accountId: string;
      }) => Promise<
        { ok: true; id: string; deleted: boolean } | { ok: false; error: string; status: 404 | 503 }
      >)
    | undefined;
  listMerchantPaymentBanks?:
    | (() => Promise<{
        ok: true;
        banks: Array<{
          code: string;
          name: string;
          kind?: string;
          logoUrl?: string | null;
          sortOrder?: number;
        }>;
      }>)
    | undefined;
  recheckMerchantOrderPayment?:
    | ((input: {
        orderId: string;
        salesChannelId: string;
        tenantId: string;
      }) => Promise<MerchantOrderActionResult>)
    | undefined;
  captureOrderPaymentByTxRef?:
    | ((input: {
        salesChannelId: string;
        source?: "chapa_webhook" | "chapa_recheck" | undefined;
        txRef: string;
      }) => Promise<
        MerchantOrderActionResult | { ok: false; error: "order_not_found"; status: 404 }
      >)
    | undefined;
  /**
   * Which delivery channels are configured on this deployment.
   * Used by the merchant settings UI to show soft unavailable states.
   */
  notificationChannelAvailability?: {
    email: boolean;
    telegram: boolean;
  };
  listNotificationPreferences?:
    | ((input: { tenantId: string }) => Promise<NotificationPreferenceListResult>)
    | undefined;
  listInAppNotifications?:
    | ((input: {
        tenantId: string;
        actorUserId: string;
        category?: "billing" | "inquiries" | "inventory" | "orders" | "system";
        cursor?: string;
        limit?: number;
        offset?: number;
        q?: string;
        unreadOnly?: boolean;
      }) => Promise<{
        count: number;
        items: Array<{
          id: string;
          eventType: string;
          category: "billing" | "inquiries" | "inventory" | "orders" | "system";
          priority: "high" | "normal";
          title: string;
          body: string;
          href: string | null;
          groupKey: string | null;
          occurrenceCount: number;
          readAt: string | null;
          seenAt: string | null;
          createdAt: string;
        }>;
        nextCursor: string | null;
      }>)
    | undefined;
  countInAppNotificationUnread?:
    | ((input: { tenantId: string; actorUserId: string }) => Promise<{ count: number }>)
    | undefined;
  markInAppNotificationRead?:
    | ((input: {
        tenantId: string;
        id: string;
        actorUserId: string;
        read: boolean;
      }) => Promise<{ ok: true } | { ok: false; error: "not_found"; status: 404 }>)
    | undefined;
  archiveInAppNotification?:
    | ((input: {
        tenantId: string;
        id: string;
        actorUserId: string;
      }) => Promise<{ ok: true } | { ok: false; error: "not_found"; status: 404 }>)
    | undefined;
  markAllInAppNotificationsRead?:
    | ((input: { tenantId: string; actorUserId: string }) => Promise<{ ok: true; updated: number }>)
    | undefined;
  markInAppNotificationsSeen?:
    | ((input: {
        tenantId: string;
        actorUserId: string;
        ids: string[];
      }) => Promise<{ ok: true; updated: number }>)
    | undefined;
  recordNotificationEvent?:
    | ((input: {
        eventType: NotificationEventType;
        payload?: unknown;
        tenantId: string;
      }) => Promise<NotificationEventRecordResult>)
    | undefined;
  /** Resolve platform tenant from Medusa sales channel (internal notification ingest). */
  resolveTenantIdByMedusaSalesChannelId?:
    | ((salesChannelId: string) => Promise<string | null>)
    | undefined;
  sendTestNotification?:
    | ((input: { channel: string; tenantId: string; destinationId?: string }) => Promise<
        | { ok: true; logId: string; jobEnqueued: boolean }
        | {
            ok: false;
            error: "notification_channel_invalid" | "notification_preference_missing";
            status: 400 | 404;
          }
      >)
    | undefined;
  listTelegramDestinations?:
    | ((input: { tenantId: string }) => Promise<{
        destinations: Array<{
          id: string;
          label: string;
          username: string | null;
          enabled: boolean;
          events: string[];
          connectedAt: string;
        }>;
      }>)
    | undefined;
  createTelegramConnectSession?:
    | ((input: { tenantId: string; userId: string }) => Promise<
        | {
            ok: true;
            session: {
              id: string;
              status: string;
              expiresAt: string;
              deepLink: string;
            };
          }
        | { ok: false; error: string; status: number }
      >)
    | undefined;
  getTelegramConnectSession?:
    | ((input: { tenantId: string; sessionId: string }) => Promise<
        | {
            ok: true;
            session: {
              id: string;
              status: string;
              expiresAt: string;
              deepLink: string | null;
            };
          }
        | { ok: false; error: string; status: number }
      >)
    | undefined;
  cancelTelegramConnectSession?:
    | ((input: {
        tenantId: string;
        sessionId: string;
      }) => Promise<{ ok: true } | { ok: false; error: string; status: number }>)
    | undefined;
  removeTelegramDestination?:
    | ((input: {
        tenantId: string;
        destinationId: string;
      }) => Promise<{ ok: true } | { ok: false; error: string; status: number }>)
    | undefined;
  setTelegramDestinationEnabled?:
    | ((input: { tenantId: string; destinationId: string; enabled: boolean }) => Promise<
        | {
            ok: true;
            destination: {
              id: string;
              label: string;
              username: string | null;
              enabled: boolean;
              events: string[];
              connectedAt: string;
            };
          }
        | { ok: false; error: string; status: number }
      >)
    | undefined;
  setTelegramSharedEvents?:
    | ((input: {
        tenantId: string;
        events: string[];
      }) => Promise<{ ok: true; events: string[] } | { ok: false; error: string; status: number }>)
    | undefined;
  listTelegramOperatorBindings?:
    | ((input: { tenantId: string }) => Promise<{
        bindings: Array<{
          id: string;
          label: string;
          username: string | null;
          enabled: boolean;
          telegramUserId: string;
          linkedAt: string;
        }>;
      }>)
    | undefined;
  createTelegramOperatorLinkSession?:
    | ((input: { tenantId: string; userId: string }) => Promise<
        | {
            ok: true;
            session: {
              id: string;
              status: string;
              expiresAt: string;
              deepLink: string;
            };
          }
        | { ok: false; error: string; status: number }
      >)
    | undefined;
  getTelegramOperatorLinkSession?:
    | ((input: { tenantId: string; sessionId: string }) => Promise<
        | {
            ok: true;
            session: {
              id: string;
              status: string;
              expiresAt: string;
              deepLink: string | null;
            };
          }
        | { ok: false; error: string; status: number }
      >)
    | undefined;
  cancelTelegramOperatorLinkSession?:
    | ((input: {
        tenantId: string;
        sessionId: string;
      }) => Promise<{ ok: true } | { ok: false; error: string; status: number }>)
    | undefined;
  removeTelegramOperatorBinding?:
    | ((input: {
        tenantId: string;
        bindingId: string;
      }) => Promise<{ ok: true } | { ok: false; error: string; status: number }>)
    | undefined;
  setTelegramOperatorBindingEnabled?:
    | ((input: { tenantId: string; bindingId: string; enabled: boolean }) => Promise<
        | {
            ok: true;
            binding: {
              id: string;
              label: string;
              username: string | null;
              enabled: boolean;
              telegramUserId: string;
              linkedAt: string;
            };
          }
        | { ok: false; error: string; status: number }
      >)
    | undefined;
  isTelegramOperatorChatForActions?:
    | ((input: { tenantId: string; chatId: string }) => Promise<{ ok: true; allowed: boolean }>)
    | undefined;
  handleTelegramWebhook?: ((update: unknown) => Promise<unknown>) | undefined;
  telegramWebhookSecret?: string | undefined;
  upsertNotificationPreference?:
    | ((input: {
        channel: string;
        enabled: boolean;
        events: string[];
        target: string;
        tenantId: string;
        userId: string;
      }) => Promise<NotificationPreferenceUpsertResult>)
    | undefined;
};
