import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createTranslator } from "next-intl";

import { messagesByLocale } from "../i18n/messages/index.js";

import {
  filterStaticCommands,
  getAllStaticCommands,
  getCommandActions,
  getNavigationCommands,
} from "./command-registry.js";
import { getNavigableAppRoutes } from "./navigation.js";

const t = createTranslator({ locale: "en", messages: messagesByLocale.en });
const translate = (key: Parameters<typeof t>[0]) => String(t(key));

describe("command registry", () => {
  it("derives navigation commands from navigable routes", () => {
    const nav = getNavigationCommands(translate);
    const routes = getNavigableAppRoutes().filter((route) => !route.disabled);
    assert.equal(nav.length, routes.length);
    assert.ok(nav.some((command) => command.href === "/admin/products"));
    assert.ok(nav.some((command) => command.label === "Products"));
  });

  it("includes create/open actions", () => {
    const actions = getCommandActions(translate);
    assert.ok(actions.some((command) => command.id === "action.create-product"));
    assert.ok(actions.some((command) => command.id === "action.billing"));
    assert.ok(actions.some((command) => command.label.toLowerCase().includes("billing")));
  });

  it("filters static commands by keyword", () => {
    const all = getAllStaticCommands(translate);
    const products = filterStaticCommands("product", all);
    assert.ok(products.length > 0);
    assert.ok(
      products.every((command) => {
        const hay = [command.label, ...command.keywords].join(" ").toLowerCase();
        return hay.includes("product");
      }),
    );
  });

  it("removes navigation and actions the member cannot use", () => {
    const commands = getAllStaticCommands(translate, new Set(["products.read"]));
    assert.ok(commands.some((command) => command.id === "nav.products"));
    assert.ok(!commands.some((command) => command.id === "nav.insights"));
    assert.ok(!commands.some((command) => command.id === "action.create-product"));
    assert.ok(!commands.some((command) => command.id === "action.create-promotion"));
  });

  it("derives read-only editor navigation from the route policy", () => {
    const commands = getNavigationCommands(translate, new Set(["storefront.read"]));
    assert.ok(commands.some((command) => command.id === "nav.editor"));
    assert.ok(!commands.some((command) => command.id === "nav.products"));
  });
});
