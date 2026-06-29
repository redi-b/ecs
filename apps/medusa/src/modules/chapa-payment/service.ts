import type {
  AuthorizePaymentInput,
  AuthorizePaymentOutput,
  CancelPaymentInput,
  CancelPaymentOutput,
  CapturePaymentInput,
  CapturePaymentOutput,
  DeletePaymentInput,
  DeletePaymentOutput,
  GetPaymentStatusInput,
  GetPaymentStatusOutput,
  InitiatePaymentInput,
  InitiatePaymentOutput,
  PaymentSessionStatus,
  ProviderWebhookPayload,
  RefundPaymentInput,
  RefundPaymentOutput,
  RetrievePaymentInput,
  RetrievePaymentOutput,
  UpdatePaymentInput,
  UpdatePaymentOutput,
  WebhookActionResult,
} from "@medusajs/framework/types";
import { AbstractPaymentProvider } from "@medusajs/framework/utils";

type ChapaPaymentOptions = {
  apiUrl?: string;
  callbackUrl?: string;
  customizationDescription?: string;
  customizationTitle?: string;
  fallbackEmail?: string;
  returnUrl?: string;
  secretKey?: string;
};

type ChapaInitializeResponse = {
  data?: {
    checkout_url?: string;
  };
  message?: string;
  status?: string;
};

type ChapaVerifyResponse = {
  data?: Record<string, unknown> & {
    status?: string;
    tx_ref?: string;
  };
  message?: string;
  status?: string;
};

type ChapaPaymentData = Record<string, unknown> & {
  checkout_url?: string;
  tx_ref?: string;
};

const defaultApiUrl = "https://api.chapa.co/v1";
const defaultFallbackEmail = "payments@example.com";

function getRecord(value: unknown) {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function getString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function getAmountString(amount: unknown) {
  if (typeof amount === "number") {
    return amount.toFixed(2);
  }

  return getString(amount) ?? "0";
}

function getCustomerContext(context: unknown) {
  const data = getRecord(context);
  const customer = getRecord(data.customer);
  const billingAddress = getRecord(data.billing_address);
  const shippingAddress = getRecord(data.shipping_address);

  return {
    email:
      getString(customer.email) ??
      getString(data.email) ??
      getString(billingAddress.email) ??
      getString(shippingAddress.email),
    firstName:
      getString(customer.first_name) ??
      getString(billingAddress.first_name) ??
      getString(shippingAddress.first_name),
    lastName:
      getString(customer.last_name) ??
      getString(billingAddress.last_name) ??
      getString(shippingAddress.last_name),
    phone:
      getString(customer.phone) ??
      getString(billingAddress.phone) ??
      getString(shippingAddress.phone),
  };
}

function getTxRef(data: unknown) {
  const paymentData = getRecord(data);

  return getString(paymentData.tx_ref);
}

function mapChapaStatus(status: string | undefined): PaymentSessionStatus {
  switch (status?.toLowerCase()) {
    case "success":
      return "captured";
    case "failed":
    case "cancelled":
    case "canceled":
      return "canceled";
    default:
      return "pending";
  }
}

class ChapaPaymentProviderService extends AbstractPaymentProvider<ChapaPaymentOptions> {
  static identifier = "chapa";

  protected readonly options_: ChapaPaymentOptions;

  constructor(container: Record<string, unknown>, options: ChapaPaymentOptions) {
    super(container, options);
    this.options_ = options;
  }

  protected get apiUrl() {
    return (this.options_.apiUrl ?? defaultApiUrl).replace(/\/$/, "");
  }

  protected get secretKey() {
    return getString(this.options_.secretKey);
  }

  protected async chapaFetch(path: string, init: RequestInit) {
    if (!this.secretKey) {
      throw new Error("CHAPA_SECRET_KEY is required to use the Chapa payment provider.");
    }

    const headers = new Headers(init.headers);
    headers.set("authorization", `Bearer ${this.secretKey}`);

    return fetch(`${this.apiUrl}${path}`, {
      ...init,
      headers,
    });
  }

  async initiatePayment({
    amount,
    currency_code,
    data,
    context,
  }: InitiatePaymentInput): Promise<InitiatePaymentOutput> {
    const paymentData = getRecord(data) as ChapaPaymentData;
    const customer = getCustomerContext(context);
    const txRef =
      getString(paymentData.tx_ref) ??
      `chapa_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

    const response = await this.chapaFetch("/transaction/initialize", {
      body: JSON.stringify({
        amount: getAmountString(amount),
        currency: currency_code.toUpperCase(),
        email: customer.email ?? this.options_.fallbackEmail ?? defaultFallbackEmail,
        first_name: customer.firstName,
        last_name: customer.lastName,
        phone_number: customer.phone,
        tx_ref: txRef,
        callback_url: this.options_.callbackUrl,
        return_url: this.options_.returnUrl,
        customization: {
          title: this.options_.customizationTitle ?? "ECS Store",
          description: this.options_.customizationDescription ?? "Order payment",
        },
      }),
      headers: {
        "content-type": "application/json",
      },
      method: "POST",
    });

    const body = (await response.json().catch(() => undefined)) as
      | ChapaInitializeResponse
      | undefined;

    if (!response.ok || !body?.data?.checkout_url) {
      throw new Error(body?.message ?? "Chapa payment initialization failed.");
    }

    return {
      id: txRef,
      data: {
        ...paymentData,
        checkout_url: body.data.checkout_url,
        tx_ref: txRef,
      },
    };
  }

  async getPaymentStatus(input: GetPaymentStatusInput): Promise<GetPaymentStatusOutput> {
    const txRef = getTxRef(input.data);

    if (!txRef) {
      return { status: "pending" };
    }

    const response = await this.chapaFetch(`/transaction/verify/${encodeURIComponent(txRef)}`, {
      method: "GET",
    });
    const body = (await response.json().catch(() => undefined)) as ChapaVerifyResponse | undefined;

    if (!response.ok) {
      return { status: "pending" };
    }

    return {
      status: mapChapaStatus(body?.data?.status ?? body?.status),
    };
  }

  async authorizePayment(input: AuthorizePaymentInput): Promise<AuthorizePaymentOutput> {
    const status = await this.getPaymentStatus(input);

    return {
      data: getRecord(input.data),
      status: status.status,
    };
  }

  async cancelPayment({ data }: CancelPaymentInput): Promise<CancelPaymentOutput> {
    return {
      data: {
        ...getRecord(data),
        status: "canceled",
      },
    };
  }

  async capturePayment({ data }: CapturePaymentInput): Promise<CapturePaymentOutput> {
    return {
      data: {
        ...getRecord(data),
        captured_at: new Date().toISOString(),
      },
    };
  }

  async deletePayment(input: DeletePaymentInput): Promise<DeletePaymentOutput> {
    return this.cancelPayment(input);
  }

  async refundPayment({ data }: RefundPaymentInput): Promise<RefundPaymentOutput> {
    throw new Error(
      `Chapa refunds are not implemented for transaction ${getTxRef(data) ?? "unknown"}.`,
    );
  }

  async retrievePayment({ data }: RetrievePaymentInput): Promise<RetrievePaymentOutput> {
    return {
      data: getRecord(data),
    };
  }

  async updatePayment({ data }: UpdatePaymentInput): Promise<UpdatePaymentOutput> {
    return {
      data: getRecord(data),
    };
  }

  async getWebhookActionAndData(
    _webhookData: ProviderWebhookPayload["payload"],
  ): Promise<WebhookActionResult> {
    return {
      action: "not_supported",
    };
  }
}

export default ChapaPaymentProviderService;
