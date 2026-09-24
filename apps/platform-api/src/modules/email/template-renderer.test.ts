import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { EMAIL_TEMPLATE_CATALOG } from "./template-catalog.js";
import { renderEmailTemplate, validateTemplateVariables } from "./template-renderer.js";

describe("email template renderer", () => {
  it("keeps every source template valid in both supported locales", () => {
    for (const template of EMAIL_TEMPLATE_CATALOG) {
      for (const locale of ["en", "am"] as const) {
        const source = template.locales[locale];
        const validation = validateTemplateVariables({
          allowed: Object.keys(template.fixtures),
          content: source.content,
          preheader: source.preheader,
          required: template.requiredVariables,
          subject: source.subject,
        });
        assert.deepEqual(validation.missing, [], `${template.key}:${locale} missing variables`);
        assert.deepEqual(validation.unknown, [], `${template.key}:${locale} has unknown variables`);
        const rendered = renderEmailTemplate({ ...source, locale, variables: template.fixtures });
        assert.ok(rendered.subject);
        assert.ok(rendered.text);
        assert.match(rendered.html, new RegExp(`<html lang="${locale}">`));
      }
    }
  });

  it("renders escaped variables and a responsive document", () => {
    const template = EMAIL_TEMPLATE_CATALOG[0];
    assert.ok(template);
    const rendered = renderEmailTemplate({
      ...template.locales.en,
      variables: { action_url: "https://example.com/verify?t=1", recipient_name: "<Liya>" },
    });
    assert.match(rendered.html, /<!doctype html>/);
    assert.match(rendered.html, /&lt;Liya&gt;/);
    assert.doesNotMatch(rendered.html, /<Liya>/);
    assert.match(rendered.text, /https:\/\/example.com\/verify\?t=1/);
  });

  it("detects missing and unsupported variables before publication", () => {
    const template = EMAIL_TEMPLATE_CATALOG[0];
    assert.ok(template);
    const validation = validateTemplateVariables({
      allowed: template.requiredVariables,
      content: template.locales.en.content,
      preheader: "{{unknown}}",
      required: template.requiredVariables,
      subject: template.locales.en.subject,
    });
    assert.deepEqual(validation.unknown, ["unknown"]);
    assert.deepEqual(validation.missing, []);
  });

  it("keeps Amharic and long shop names in the same mobile-safe shell", () => {
    const template = EMAIL_TEMPLATE_CATALOG.find(
      (item) => item.key === "account.organization_invitation",
    );
    assert.ok(template);
    const rendered = renderEmailTemplate({
      ...template.locales.am,
      locale: "am",
      variables: {
        action_url: "https://app.example.com/invitation/preview",
        inviter_name: "Betelhem Wondimu Tesfaye",
        recipient_name: "Kidist Selamawit Gebremedhin",
        shop_name: "Addis Ababa Artisan Home and Lifestyle Market",
      },
    });
    assert.match(rendered.html, /<html lang="am">/);
    assert.match(rendered.html, /name="viewport"/);
    assert.match(rendered.html, /max-width:600px/);
    assert.match(rendered.text, /Addis Ababa Artisan Home and Lifestyle Market/);
  });
});
