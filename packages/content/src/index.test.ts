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

  it("keeps headings and safe media while stripping unsafe image sources", () => {
    assert.equal(
      sanitizeProductDescription(
        '<h1>Materials</h1><img src="https://cdn.example.com/detail.webp" alt="Detail" title="Close-up"><img src="javascript:alert(1)" onerror="alert(1)">',
      ),
      '<h1>Materials</h1><img src="https://cdn.example.com/detail.webp" alt="Detail" title="Close-up" /><img />',
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

  it("parses Markdown into clean sanitized HTML", () => {
    const md = `
Overview text here.

### Key Highlights
- Feature one
- Feature two

### Specifications
| Specification | Detail |
| :--- | :--- |
| **Battery** | 5000 mAh |

> **Note:** Fast shipping available.
    `.trim();

    const html = sanitizeProductDescription(md);
    assert.ok(html?.includes("<p>Overview text here.</p>"));
    assert.ok(html?.includes("<h3>Key Highlights</h3>"));
    assert.ok(html?.includes("<ul>"));
    assert.ok(html?.includes("<li>Feature one</li>"));
    assert.ok(html?.includes("<table>"));
    assert.ok(html?.includes("Specification</th>"));
    assert.ok(html?.includes("<strong>Battery</strong></td>"));
    assert.ok(html?.includes("<blockquote>"));
    assert.ok(html?.includes("<strong>Note:</strong>"));
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
