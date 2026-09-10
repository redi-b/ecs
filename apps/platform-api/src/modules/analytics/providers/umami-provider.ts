import {
  type AnalyticsDimension,
  AnalyticsProviderError,
  type StorefrontAnalyticsProvider,
} from "./types.js";

type UmamiProviderOptions = {
  baseUrl: string;
  fetch?: typeof fetch;
  password: string;
  username: string;
};

type UnknownRecord = Record<string, unknown>;

const dimensionNames: Record<AnalyticsDimension, string> = {
  browser: "browser",
  country: "country",
  device: "device",
  path: "path",
  referrer: "referrer",
};

export function createUmamiAnalyticsProvider(
  options: UmamiProviderOptions,
): StorefrontAnalyticsProvider {
  const requestFetch = options.fetch ?? fetch;
  const baseUrl = options.baseUrl.replace(/\/+$/, "");
  let token: string | null = null;

  async function authenticate() {
    const response = await requestFetch(`${baseUrl}/api/auth/login`, {
      body: JSON.stringify({ password: options.password, username: options.username }),
      headers: { accept: "application/json", "content-type": "application/json" },
      method: "POST",
      signal: AbortSignal.timeout(10_000),
    }).catch((cause) => {
      throw new AnalyticsProviderError("analytics_provider_unavailable", { cause });
    });
    if (!response.ok) {
      throw new AnalyticsProviderError("analytics_provider_auth_failed", {
        status: response.status,
      });
    }
    const body = await readObject(response);
    if (typeof body.token !== "string" || !body.token) {
      throw new AnalyticsProviderError("analytics_provider_invalid_response", {
        status: response.status,
      });
    }
    token = body.token;
    return token;
  }

  async function request(path: string, init?: RequestInit, retryAuth = true) {
    const authorization = token ?? (await authenticate());
    const response = await requestFetch(`${baseUrl}/api${path}`, {
      ...init,
      headers: {
        accept: "application/json",
        authorization: `Bearer ${authorization}`,
        ...(init?.body ? { "content-type": "application/json" } : {}),
        ...init?.headers,
      },
      signal: init?.signal ?? AbortSignal.timeout(12_000),
    }).catch((cause) => {
      throw new AnalyticsProviderError("analytics_provider_unavailable", { cause });
    });
    if (response.status === 401 && retryAuth) {
      token = null;
      return request(path, init, false);
    }
    if (!response.ok) {
      throw new AnalyticsProviderError("analytics_provider_request_failed", {
        status: response.status,
      });
    }
    return response;
  }

  async function provisionSite(input: { domain: string; name: string; requestedId?: string }) {
    const response = await request("/websites", {
      body: JSON.stringify({
        domain: input.domain,
        ...(input.requestedId ? { id: input.requestedId } : {}),
        name: input.name,
      }),
      method: "POST",
    });
    const body = await readObject(response);
    if (typeof body.id !== "string" || !body.id) {
      throw new AnalyticsProviderError("analytics_provider_invalid_response", {
        status: response.status,
      });
    }
    return { siteId: body.id };
  }

  return {
    async ensureSite(input) {
      if (input.requestedId) {
        try {
          const response = await request(`/websites/${encodeURIComponent(input.requestedId)}`);
          const value = await readJson(response);
          if (value === null) return provisionSite(input);
          if (!isRecord(value)) {
            throw new AnalyticsProviderError("analytics_provider_invalid_response", {
              status: response.status,
            });
          }
          const current = value;
          if (current.domain !== input.domain || current.name !== input.name) {
            await request(`/websites/${encodeURIComponent(input.requestedId)}`, {
              body: JSON.stringify({ domain: input.domain, name: input.name }),
              method: "POST",
            });
          }
          return { siteId: input.requestedId };
        } catch (error) {
          if (!(error instanceof AnalyticsProviderError) || error.status !== 404) throw error;
        }
      }
      return provisionSite(input);
    },

    provisionSite,

    async getTrafficSummary(input) {
      const params = rangeParams(input.range);
      const body = await readObject(
        await request(`/websites/${encodeURIComponent(input.siteId)}/stats?${params}`),
      );
      const visits = requiredNumber(body.visits);
      const bounces = requiredNumber(body.bounces);
      const totalTime = requiredNumber(body.totaltime);
      return {
        bounceRate: visits > 0 ? bounces / visits : null,
        pageViews: requiredNumber(body.pageviews),
        visitDurationSeconds: visits > 0 ? totalTime / visits : null,
        visitors: requiredNumber(body.visitors),
        visits,
      };
    },

    async getTimeSeries(input) {
      const params = rangeParams(input.range, { unit: chooseUnit(input.range) });
      const body = await readObject(
        await request(`/websites/${encodeURIComponent(input.siteId)}/pageviews?${params}`),
      );
      const pageviews = readSeries(body.pageviews);
      const sessions = readSeries(body.sessions);
      const visitsByDate = new Map(sessions.map((point) => [point.date, point.value]));
      return pageviews.map((point) => ({
        date: point.date,
        pageViews: point.value,
        visits: visitsByDate.get(point.date) ?? 0,
      }));
    },

    async getDimensions(input) {
      const params = rangeParams(input.range, {
        limit: String(input.limit),
        type: dimensionNames[input.dimension],
      });
      const body = await readJson(
        await request(`/websites/${encodeURIComponent(input.siteId)}/metrics?${params}`),
      );
      if (!Array.isArray(body)) {
        throw new AnalyticsProviderError("analytics_provider_invalid_response");
      }
      return body.map((row) => {
        if (!isRecord(row) || typeof row.x !== "string") {
          throw new AnalyticsProviderError("analytics_provider_invalid_response");
        }
        return { key: row.x, visits: requiredNumber(row.y) };
      });
    },

    async trackEvent(input) {
      const response = await requestFetch(`${baseUrl}/api/send`, {
        body: JSON.stringify({
          payload: {
            ...(input.data ? { data: input.data } : {}),
            ...(input.eventName ? { name: input.eventName } : {}),
            hostname: input.hostname,
            ...(input.language ? { language: input.language } : {}),
            ...(input.referrer ? { referrer: input.referrer } : {}),
            ...(input.screen ? { screen: input.screen } : {}),
            ...(input.sessionId ? { id: input.sessionId } : {}),
            title: input.title ?? "",
            url: input.url,
            website: input.siteId,
          },
          type: "event",
        }),
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          ...(input.clientIp ? { "x-forwarded-for": input.clientIp } : {}),
          "user-agent": input.userAgent,
        },
        method: "POST",
        signal: AbortSignal.timeout(8_000),
      }).catch((cause) => {
        throw new AnalyticsProviderError("analytics_provider_unavailable", { cause });
      });
      if (!response.ok) {
        throw new AnalyticsProviderError("analytics_provider_request_failed", {
          status: response.status,
        });
      }
    },
  };
}

function rangeParams(
  range: { from: Date; timezone: string; to: Date },
  extra: Record<string, string> = {},
) {
  return new URLSearchParams({
    endAt: String(range.to.getTime()),
    startAt: String(range.from.getTime()),
    timezone: range.timezone,
    ...extra,
  }).toString();
}

function chooseUnit(range: { from: Date; to: Date }) {
  const days = (range.to.getTime() - range.from.getTime()) / 86_400_000;
  return days > 180 ? "month" : "day";
}

async function readJson(response: Response): Promise<unknown> {
  return response.json().catch((cause) => {
    throw new AnalyticsProviderError("analytics_provider_invalid_response", {
      cause,
      status: response.status,
    });
  });
}

async function readObject(response: Response) {
  const value = await readJson(response);
  if (!isRecord(value)) {
    throw new AnalyticsProviderError("analytics_provider_invalid_response", {
      status: response.status,
    });
  }
  return value;
}

function readSeries(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((row) => {
    if (!isRecord(row) || typeof row.x !== "string") {
      throw new AnalyticsProviderError("analytics_provider_invalid_response");
    }
    return { date: row.x, value: requiredNumber(row.y) };
  });
}

function requiredNumber(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new AnalyticsProviderError("analytics_provider_invalid_response");
  }
  return value;
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
