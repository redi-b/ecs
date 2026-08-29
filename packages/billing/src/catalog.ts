import type { CapabilityCatalog, CapabilityDefinition } from "./domain.js";

export function defineCapabilityCatalog<const TCatalog extends CapabilityCatalog>(
  catalog: TCatalog,
): TCatalog {
  for (const [key, definition] of Object.entries<CapabilityDefinition>(catalog)) {
    if (!/^[a-z][a-zA-Z0-9]*$/.test(key)) {
      throw new Error(`Invalid capability key: ${key}`);
    }
    if (definition.kind === "boolean" && definition.defaultValue !== false) {
      throw new Error(`Boolean capability ${key} must fail closed`);
    }
    if (definition.kind === "limit" && definition.defaultValue !== 0) {
      throw new Error(`Limited capability ${key} must fail closed`);
    }
  }
  return Object.freeze(catalog);
}
