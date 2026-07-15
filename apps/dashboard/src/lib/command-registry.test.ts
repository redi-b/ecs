import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  commandActions,
  filterStaticCommands,
  getAllStaticCommands,
  getNavigationCommands,
} from "./command-registry.js";
import { getNavigableAppRoutes } from "./navigation.js";

describe("command registry", () => {
  it("derives navigation commands from navigable routes", () => {
    const nav = getNavigationCommands();
    const routes = getNavigableAppRoutes().filter((route) => !route.disabled);
    assert.equal(nav.length, routes.length);
    assert.ok(nav.some((command) => command.href === "/admin/products"));
  });

  it("includes create/open actions", () => {
    assert.ok(commandActions.some((command) => command.id === "action.create-product"));
    assert.ok(commandActions.some((command) => command.label.toLowerCase().includes("billing")));
  });

  it("filters static commands by keyword", () => {
    const all = getAllStaticCommands();
    const products = filterStaticCommands("product", all);
    assert.ok(products.length > 0);
    assert.ok(products.every((command) => {
      const hay = [command.label, ...command.keywords].join(" ").toLowerCase();
      return hay.includes("product");
    }));
  });
});
