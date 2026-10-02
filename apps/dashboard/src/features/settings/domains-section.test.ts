import assert from "node:assert/strict";
import { test } from "node:test";
import type { TenantDomainContract, TenantDomainSetup } from "@ecs/contracts";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { messagesByLocale } from "@/i18n/messages";
import { DomainsSection } from "./domains-section";

const setup: TenantDomainSetup = {
  enabled: true,
  entitled: true,
  dnsTarget: "domains.ecset.dev",
  ingressIpv4: ["178.238.224.27"],
};
const managed: TenantDomainContract = {
  id: "managed",
  hostname: "bolestyle.ecset.dev",
  type: "platform_subdomain",
  status: "active",
  verificationStatus: "verified",
  sslStatus: "active",
  isPrimary: true,
};
const pending: TenantDomainContract = {
  ...managed,
  id: "custom",
  hostname: "shop.example.com",
  type: "custom_domain",
  status: "pending_certificate",
  sslStatus: "pending",
  isPrimary: false,
  verificationChallenge: {
    recordName: "_ecs.shop.example.com",
    recordValue: "ecs-owner-proof",
    expiresAt: "2099-01-01T00:00:00.000Z",
  },
};
function render(overrides: Record<string, unknown> = {}, locale: "en" | "am" = "en") {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  try {
    return renderToStaticMarkup(
      createElement(
        QueryClientProvider,
        { client },
        createElement(
          NextIntlClientProvider,
          {
            locale,
            messages: messagesByLocale[locale],
            timeZone: "Africa/Addis_Ababa",
          } as Parameters<typeof NextIntlClientProvider>[0],
          createElement(DomainsSection, {
            tenantId: "tenant",
            initialDomains: [managed, pending],
            initialSetup: setup,
            ...overrides,
          }),
        ),
      ),
    );
  } finally {
    client.clear();
  }
}
test("configured setup starts compact and keeps DNS instructions behind setup action", () => {
  const html = render();
  assert.doesNotMatch(html, /name="hostname"/);
  assert.match(html, /bolestyle.ecset.dev/);
  assert.match(html, /data-domain-row="true"/);
  assert.doesNotMatch(html, /href="https:\/\/shop.example.com"/);
  assert.doesNotMatch(html, /Make primary/);
  assert.doesNotMatch(html, /aren’t available yet/);
});
test("domains share a compact address list with secondary actions out of the main flow", () => {
  const html = render();
  assert.match(html, /data-slot="domain-list"/);
  assert.match(html, /data-domain-row="true"/);
  assert.doesNotMatch(html, />Check ownership<|>Remove domain</);
});
test("only a fully active custom domain can open and become primary", () => {
  const html = render({
    initialDomains: [managed, { ...pending, status: "active", sslStatus: "active" }],
  });
  assert.match(html, /data-domain-row="true"/);
  assert.doesNotMatch(html, /ecs-owner-proof/);
});
test("load errors offer retry rather than an invented empty state", () => {
  const html = render({ initialDomains: [], initialLoadFailed: true });
  assert.match(html, /Could not load connected domains/);
  assert.match(html, /Try again/);
  assert.doesNotMatch(html, /name="hostname"/);
});
test("disabled connection setup still exposes existing domain management", () => {
  const html = render({ initialSetup: { ...setup, enabled: false } });
  assert.doesNotMatch(html, /name="hostname"/);
  assert.match(html, /data-domain-row="true"/);
  assert.doesNotMatch(html, /ecs-owner-proof/);
});
test("feature availability takes precedence over upgrade prompts and connection instructions", () => {
  const disabled = render({ initialSetup: { ...setup, enabled: false, entitled: false } });
  assert.ok(disabled.includes(messagesByLocale.en.settings.domains.disabled));
  assert.ok(!disabled.includes(messagesByLocale.en.settings.domains.accessRequired));
  assert.ok(!disabled.includes(messagesByLocale.en.settings.domains.limit));
  const upgrade = render({ initialSetup: { ...setup, enabled: true, entitled: false } });
  assert.ok(upgrade.includes(messagesByLocale.en.settings.domains.accessRequired));
  assert.ok(!upgrade.includes(messagesByLocale.en.settings.domains.limit));
});
test("managed recovery address can become primary again", () => {
  const html = render({ initialDomains: [{ ...managed, isPrimary: false }] });
  assert.match(html, /data-domain-row="true"/);
});
test("removing domain exposes no open, primary, ownership or repeated removal action", () => {
  const html = render({ initialDomains: [{ ...pending, status: "removing" }] });
  assert.match(html, /Routing removal is in progress/);
  assert.doesNotMatch(
    html,
    /href="https:\/\/shop.example.com"|Make primary|Check ownership|Remove domain/,
  );
});
test("expired initial ownership offers renewal, not a failing DNS check", () => {
  const html = render({
    initialDomains: [
      {
        ...pending,
        status: "pending_verification",
        verificationStatus: "pending",
        verificationChallenge: {
          ...pending.verificationChallenge,
          recordName: "_ecs.shop.example.com",
          recordValue: "expired-proof",
          expiresAt: "2000-01-01T00:00:00.000Z",
        },
      },
    ],
  });
  assert.match(html, /data-domain-row="true"/);
});
test("unknown lifecycle fails safely without certificate provisioning fiction", () => {
  const html = render({ initialDomains: [{ ...pending, status: "unknown" }] });
  assert.match(html, /Connection failed/);
  assert.doesNotMatch(html, /Ownership verified\. Secure certificate provisioning/);
});
test("actionable CAA diagnostic and grace deadline render in both locales", () => {
  for (const locale of ["en", "am"] as const) {
    const html = render(
      {
        initialDomains: [
          {
            ...pending,
            status: "misconfigured",
            warningGraceExpiresAt: "2026-10-08T00:00:00.000Z",
            diagnostics: {
              checkedAt: "2026-10-01T00:00:00.000Z",
              reason: "caa_restricted",
              detail: "http01_not_allowed",
            },
          },
        ],
      },
      locale,
    );
    assert.doesNotMatch(html, /ecs-owner-proof/);
    assert.doesNotMatch(html, /settings\.domains\.|http01_not_allowed/);
    if (locale === "en") {
      assert.match(html, /HTTP-01/);
      assert.match(html, /Restore DNS before/);
    }
  }
});
