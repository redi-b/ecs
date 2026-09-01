import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { productDescriptionToText, sanitizeProductDescription } from "./index";

describe("product rich text", () => {
  it("keeps supported merchandising markup", () => {
    assert.equal(
      sanitizeProductDescription(
        '<h2>Built to last</h2><p><strong>Durable</strong> and useful. <a href="https://example.com">Guide</a></p>',
      ),
      '<h2>Built to last</h2><p><strong>Durable</strong> and useful. <a href="https://example.com">Guide</a></p>',
    );
  });

  it("removes scripts, event handlers, and unsafe links", () => {
    assert.equal(
      sanitizeProductDescription(
        '<p onclick="alert(1)">Safe<script>alert(1)</script><a href="javascript:alert(1)">link</a></p>',
      ),
      "<p>Safe<a>link</a></p>",
    );
  });

  it("creates a normalized plain-text projection", () => {
    assert.equal(
      productDescriptionToText(
        "<h2>Care &amp; use</h2><ul><li>Wash gently</li><li>Air dry</li></ul>",
      ),
      "Care & use Wash gently Air dry",
    );
    assert.equal(
      productDescriptionToText("<p>Built for <strong>daily work</strong>.</p>"),
      "Built for daily work.",
    );
  });
});
