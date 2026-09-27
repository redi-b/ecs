import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { saveStorefrontLanguageSettings } from "./storefront-languages-client";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("saveStorefrontLanguageSettings", () => {
  it("uses the shared language action and returns the saved settings", async () => {
    let requestedUrl = "";
    let requestedInit: RequestInit | undefined;
    globalThis.fetch = async (input, init) => {
      requestedUrl = String(input);
      requestedInit = init;
      return Response.json({
        languageSettings: {
          sourceLocale: "en",
          defaultLocale: "en",
          enabledLocales: ["en", "am"],
        },
      });
    };

    const result = await saveStorefrontLanguageSettings({
      languageSettings: {
        sourceLocale: "en",
        defaultLocale: "en",
        enabledLocales: ["en", "am"],
      },
      tenantId: "tenant_1",
    });

    assert.deepEqual(result, {
      ok: true,
      languageSettings: {
        sourceLocale: "en",
        defaultLocale: "en",
        enabledLocales: ["en", "am"],
      },
    });
    assert.equal(requestedUrl, "/dashboard/storefront/languages");
    assert.equal(requestedInit?.method, "POST");
    assert.deepEqual(JSON.parse(String(requestedInit?.body)), {
      tenantId: "tenant_1",
      languageSettings: {
        sourceLocale: "en",
        defaultLocale: "en",
        enabledLocales: ["en", "am"],
      },
    });
  });

  it("keeps transport and API failures inside the shared result contract", async () => {
    globalThis.fetch = async () => Response.json({ message: "forbidden" }, { status: 403 });
    assert.deepEqual(
      await saveStorefrontLanguageSettings({
        languageSettings: {
          sourceLocale: "en",
          defaultLocale: "en",
          enabledLocales: ["en"],
        },
        tenantId: "tenant_1",
      }),
      { ok: false, message: "forbidden" },
    );

    globalThis.fetch = async () => {
      throw new Error("offline");
    };
    assert.deepEqual(
      await saveStorefrontLanguageSettings({
        languageSettings: {
          sourceLocale: "en",
          defaultLocale: "en",
          enabledLocales: ["en"],
        },
        tenantId: "tenant_1",
      }),
      { ok: false, message: null },
    );
  });
});
