import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import { changeOperationsTheme } from "./theme-transition.js";

const originalDocument = globalThis.document;
const originalWindow = globalThis.window;

afterEach(() => {
  Object.defineProperty(globalThis, "document", { configurable: true, value: originalDocument });
  Object.defineProperty(globalThis, "window", { configurable: true, value: originalWindow });
});

test("changes the Operations theme with a calm element fade, never a view-transition reveal", async () => {
  const frames: Keyframe[] = [];
  let viewTransitionCalls = 0;
  const root = {
    animate(keyframes: Keyframe[]) {
      frames.push(...keyframes);
      return { finished: Promise.resolve() };
    },
  };

  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      documentElement: root,
      startViewTransition() {
        viewTransitionCalls += 1;
      },
    },
  });
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { matchMedia: () => ({ matches: false }) },
  });

  const themes: string[] = [];
  await changeOperationsTheme((theme) => themes.push(theme), "dark");

  assert.equal(viewTransitionCalls, 0);
  assert.deepEqual(themes, ["dark"]);
  assert.deepEqual(frames, [{ opacity: 1 }, { opacity: 0.82 }, { opacity: 0.82 }, { opacity: 1 }]);
});
