import assert from "node:assert/strict";
import test from "node:test";

import { copyTextToClipboard } from "./clipboard";

test("copyTextToClipboard falls back when the Clipboard API is unavailable", async () => {
  const windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, "window");
  const navigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  const documentDescriptor = Object.getOwnPropertyDescriptor(globalThis, "document");
  let copiedValue = "";
  const textarea = {
    remove: () => undefined,
    select: () => undefined,
    setAttribute: () => undefined,
    style: {},
    value: "",
  };

  Object.defineProperty(globalThis, "window", { configurable: true, value: globalThis });
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { clipboard: undefined },
  });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      body: {
        appendChild: () => undefined,
        removeChild: () => undefined,
      },
      createElement: () => textarea,
      execCommand: (command: string) => {
        copiedValue = command === "copy" ? textarea.value : "";
        return command === "copy";
      },
    },
  });

  try {
    assert.equal(await copyTextToClipboard("schema_version,product_title"), true);
    assert.equal(copiedValue, "schema_version,product_title");
  } finally {
    restoreGlobal("window", windowDescriptor);
    restoreGlobal("navigator", navigatorDescriptor);
    restoreGlobal("document", documentDescriptor);
  }
});

function restoreGlobal(key: "document" | "navigator" | "window", descriptor?: PropertyDescriptor) {
  if (descriptor) Object.defineProperty(globalThis, key, descriptor);
  else Reflect.deleteProperty(globalThis, key);
}
