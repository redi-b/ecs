import assert from "node:assert/strict";
import { test } from "node:test";
import { getBrandPresets } from "./brand-presets";
import {
  contrastRatio,
  deriveTextContrast,
  ensureContrast,
  ensureFillLabelContrast,
  MIN_LINK_CONTRAST,
  MIN_TEXT_CONTRAST,
} from "./palette";

/**
 * Brand primaries are authored as fills. These tests pin the guarantee that
 * every derived *text* role is actually legible, for every template preset.
 */

test("ensureContrast clears 4.5:1 for a near-white pastel primary", () => {
  // Luvia's designed primary: 1.67:1 as text on its own background.
  const text = ensureContrast("#3ee272", "#f7fff7", MIN_TEXT_CONTRAST);
  assert.ok(
    contrastRatio(text, "#f7fff7") >= MIN_TEXT_CONTRAST,
    `${text} should clear 4.5:1, got ${contrastRatio(text, "#f7fff7")}`,
  );
});

test("ensureContrast returns the input unchanged when it already passes", () => {
  assert.equal(ensureContrast("#0f3112", "#f7fff7", MIN_TEXT_CONTRAST), "#0f3112");
});

test("ensureContrast lightens against a dark surface instead of darkening", () => {
  // A dark primary on a dark surface must be lightened, not darkened further.
  const text = ensureContrast("#0b0f0d", "#0b0f0d", MIN_TEXT_CONTRAST);
  assert.ok(contrastRatio(text, "#0b0f0d") >= MIN_TEXT_CONTRAST);
  assert.ok(
    parseInt(text.slice(1, 3), 16) > parseInt("#0b0f0d".slice(1, 3), 16),
    "expected a lighter result on a dark background",
  );
});

test("ensureFillLabelContrast leaves a fill alone when the label already passes", () => {
  const { fill, label } = ensureFillLabelContrast("#3ee272");
  assert.equal(fill, "#3ee272");
  assert.ok(contrastRatio(fill, label) >= MIN_LINK_CONTRAST);
});

test("ensureFillLabelContrast shifts a mid-tone fill so 7:1 is reachable", () => {
  // #3064d5 tops out at 5.37:1 with white — no label color can reach 7:1.
  const { fill, label } = ensureFillLabelContrast("#3064d5");
  assert.notEqual(fill, "#3064d5", "mid-tone fill should be adjusted");
  assert.ok(
    contrastRatio(fill, label) >= MIN_LINK_CONTRAST,
    `${fill} on ${label} should clear 7:1, got ${contrastRatio(fill, label)}`,
  );
});

test("every brand preset derives legible text roles", () => {
  for (const templateKey of ["luvia@1", "nexahub@1", "afro@1"]) {
    for (const preset of getBrandPresets(templateKey)) {
      const { background, primary } = preset.colors;
      const label = `${templateKey}/${preset.id}`;

      const tokens = deriveTextContrast(primary, background);
      assert.ok(
        contrastRatio(tokens.text, background) >= MIN_TEXT_CONTRAST,
        `${label} text ${tokens.text} on ${background} = ${contrastRatio(tokens.text, background)}`,
      );
      assert.ok(
        contrastRatio(tokens.link, background) >= MIN_LINK_CONTRAST,
        `${label} link ${tokens.link} on ${background} = ${contrastRatio(tokens.link, background)}`,
      );
      assert.ok(
        contrastRatio(tokens.fill, tokens.onPrimary) >= MIN_LINK_CONTRAST,
        `${label} label ${tokens.onPrimary} on ${tokens.fill} = ${contrastRatio(tokens.fill, tokens.onPrimary)}`,
      );
    }
  }
});
