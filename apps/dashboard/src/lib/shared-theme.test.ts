import assert from "node:assert/strict";
import { test } from "node:test";
import { runInNewContext } from "node:vm";

import { getThemeBootstrapScript } from "./shared-theme";

function resolveTheme(cookie = "", prefersDark?: boolean, stored: string | null = null) {
  let dark = false;
  const root = {
    classList: { toggle: (_name: string, value: boolean) => { dark = value; } },
    style: { colorScheme: "" },
  };
  runInNewContext(getThemeBootstrapScript(), {
    document: { cookie, documentElement: root },
    localStorage: { getItem: () => stored },
    window: prefersDark === undefined ? {} : {
      matchMedia: () => ({ matches: prefersDark }),
    },
  });
  return { dark, colorScheme: root.style.colorScheme };
}

test("new visitors follow device preference with dark as the unavailable-preference fallback", () => {
  assert.equal(resolveTheme("", true).dark, true);
  assert.equal(resolveTheme("", false).dark, false);
  assert.deepEqual(resolveTheme(), { dark: true, colorScheme: "dark" });
});

test("saved theme takes precedence over device preference", () => {
  assert.equal(resolveTheme("ecs-theme=light", true).dark, false);
  assert.equal(resolveTheme("ecs-theme=dark", false).dark, true);
  assert.equal(resolveTheme("", true, "light").dark, false);
  assert.equal(resolveTheme("ecs-theme=dark", true, "light").dark, true);
});

test("invalid theme values fall back to the device preference", () => {
  assert.equal(resolveTheme("ecs-theme=invalid", true).dark, true);
});
