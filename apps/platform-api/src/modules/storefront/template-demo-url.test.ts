import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getDefaultTemplateDemoUrl, getTemplateDemoBaseUrl } from "./template-demo-url.js";

describe("template demo URLs", () => {
  it("uses http for local wildcard hosts", () => {
    assert.equal(getTemplateDemoBaseUrl("demo.lvh.me"), "http://demo.lvh.me/");
  });

  it("uses https for production hosts", () => {
    assert.equal(getTemplateDemoBaseUrl("demo.example.com"), "https://demo.example.com/");
  });

  it("normalizes an explicit base URL", () => {
    assert.equal(getTemplateDemoBaseUrl("https://demo.example.com/ignored?x=1#hash"),
      "https://demo.example.com/",
    );
  });

  it("builds the conventional template path", () => {
    assert.equal(getDefaultTemplateDemoUrl("https://demo.example.com/", "nexahub"),
      "https://demo.example.com/nexahub",
    );
  });

  it("rejects unsupported or missing hosts", () => {
    assert.equal(getTemplateDemoBaseUrl("ftp://demo.example.com"), null);
    assert.equal(getTemplateDemoBaseUrl(" "), null);
  });
});
