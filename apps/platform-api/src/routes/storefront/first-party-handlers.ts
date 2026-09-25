import { z } from "zod";

import type { PlatformAppOptions } from "../../app.js";

const inquirySchema = z
  .object({
    type: z.enum(["contact", "product_request"]),
    customerName: z.string().trim().min(2).max(120),
    customerEmail: z.string().trim().email().max(254).nullable().optional(),
    customerPhone: z.string().trim().max(60).nullable().optional(),
    subject: z.string().trim().min(2).max(180),
    message: z.string().trim().min(2).max(5_000),
    sourcePath: z.string().trim().max(500).nullable().optional(),
    website: z.string().max(500).optional(),
    details: z.record(z.string(), z.string().trim().max(1_000)).optional(),
  })
  .superRefine((value, context) => {
    if (!value.customerEmail && !value.customerPhone) {
      context.addIssue({
        code: "custom",
        message: "An email address or phone number is required.",
      });
    }
  });

const inquiryWindows = new Map<string, { count: number; resetAt: number }>();

function consumeInquiryRateLimit(key: string, now = Date.now()) {
  if (inquiryWindows.size > 10_000) {
    for (const [windowKey, window] of inquiryWindows) {
      if (window.resetAt <= now) inquiryWindows.delete(windowKey);
    }
    if (inquiryWindows.size > 10_000)
      inquiryWindows.delete(inquiryWindows.keys().next().value ?? "");
  }
  const current = inquiryWindows.get(key);
  if (!current || current.resetAt <= now) {
    inquiryWindows.set(key, { count: 1, resetAt: now + 10 * 60_000 });
    return true;
  }
  if (current.count >= 5) return false;
  current.count += 1;
  return true;
}

export async function createStorefrontInquiry(options: {
  createInquiry: NonNullable<PlatformAppOptions["createStorefrontInquiry"]>;
  recordNotificationEvent?: PlatformAppOptions["recordNotificationEvent"];
  request: Request;
  tenantId: string;
}) {
  let raw: unknown;
  try {
    raw = await options.request.json();
  } catch {
    return Response.json({ error: "invalid_inquiry" }, { status: 400 });
  }

  const parsed = inquirySchema.safeParse(raw);
  if (!parsed.success) {
    return Response.json(
      { error: "invalid_inquiry", message: parsed.error.issues[0]?.message },
      { status: 400 },
    );
  }

  // A filled honeypot gets a generic success response so bots cannot tune around it.
  if (parsed.data.website) {
    return Response.json({ inquiry: { accepted: true } }, { status: 202 });
  }

  const forwardedFor = options.request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const rateKey = `${options.tenantId}:${forwardedFor || "unknown"}`;
  if (!consumeInquiryRateLimit(rateKey)) {
    return Response.json({ error: "inquiry_rate_limited" }, { status: 429 });
  }

  const result = await options.createInquiry({
    customerEmail: parsed.data.customerEmail || null,
    customerName: parsed.data.customerName,
    customerPhone: parsed.data.customerPhone || null,
    details: parsed.data.details ?? {},
    message: parsed.data.message,
    sourcePath: parsed.data.sourcePath || null,
    subject: parsed.data.subject,
    tenantId: options.tenantId,
    type: parsed.data.type,
  });

  if (options.recordNotificationEvent) {
    await options
      .recordNotificationEvent({
        eventType: "storefront.inquiry_created",
        tenantId: options.tenantId,
        payload: {
          inquiryId: result.inquiry.id,
          type: parsed.data.type,
          customerName: parsed.data.customerName,
          customerEmail: parsed.data.customerEmail || null,
          customerPhone: parsed.data.customerPhone || null,
          subject: parsed.data.subject,
        },
      })
      .catch(() => undefined);
  }

  return Response.json({ inquiry: result.inquiry }, { status: 201 });
}

export async function getOptionalJsonObjectBody(request: Request) {
  const rawBody = await request.text();

  if (!rawBody.trim()) {
    return {};
  }

  const parsed = JSON.parse(rawBody);

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("Expected a JSON object body.");
  }

  return parsed as Record<string, unknown>;
}

export async function recordStorefrontAnalyticsEvent(options: {
  hostname: string;
  recordAnalyticsEvent: NonNullable<PlatformAppOptions["recordAnalyticsEvent"]>;
  recordStorefrontBehavior?: PlatformAppOptions["recordStorefrontBehavior"];
  request: Request;
  tenantId: string;
}) {
  let body: Record<string, unknown>;

  try {
    body = await getOptionalJsonObjectBody(options.request);
  } catch {
    return Response.json({ error: "invalid_analytics_event" }, { status: 400 });
  }

  if (typeof body.eventType !== "string") {
    return Response.json({ error: "analytics_event_type_required" }, { status: 400 });
  }

  const event = await options.recordAnalyticsEvent({
    customerId: typeof body.customerId === "string" ? body.customerId : null,
    eventType: body.eventType,
    idempotencyKey: typeof body.idempotencyKey === "string" ? body.idempotencyKey : null,
    occurredAt: typeof body.occurredAt === "string" ? body.occurredAt : null,
    properties: body.properties,
    sessionId: typeof body.sessionId === "string" ? body.sessionId : null,
    source: "storefront",
    subjectId: typeof body.subjectId === "string" ? body.subjectId : null,
    subjectType: typeof body.subjectType === "string" ? body.subjectType : null,
    tenantId: options.tenantId,
  });

  if (!event.ok) {
    return Response.json({ error: event.error }, { status: event.status });
  }

  const behaviorProperties =
    typeof body.properties === "object" &&
    body.properties !== null &&
    !Array.isArray(body.properties)
      ? (body.properties as Record<string, unknown>)
      : null;
  const url =
    typeof body.url === "string"
      ? body.url
      : typeof behaviorProperties?.path === "string"
        ? behaviorProperties.path
        : "/";
  if (options.recordStorefrontBehavior) {
    void options.recordStorefrontBehavior({
      clientIp:
        options.request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
        options.request.headers.get("x-real-ip"),
      eventType: body.eventType,
      hostname: options.hostname,
      language: typeof body.language === "string" ? body.language : null,
      properties: behaviorProperties,
      referrer: typeof body.referrer === "string" ? body.referrer : null,
      screen: typeof body.screen === "string" ? body.screen : null,
      sessionId: typeof body.sessionId === "string" ? body.sessionId : null,
      subjectId: typeof body.subjectId === "string" ? body.subjectId : null,
      subjectType: typeof body.subjectType === "string" ? body.subjectType : null,
      tenantId: options.tenantId,
      title: typeof body.title === "string" ? body.title : null,
      url,
      userAgent: options.request.headers.get("user-agent"),
    });
  }

  return Response.json(
    {
      event: {
        duplicate: event.duplicate,
        id: event.event.id,
      },
    },
    { status: 202 },
  );
}
