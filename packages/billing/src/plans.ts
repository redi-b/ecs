import type {
  CapabilityCatalog,
  CapabilityDefinition,
  PlanId,
  PlanTerms,
  PlanVersionId,
  PublishedPlanVersion,
} from "./domain.js";

export type PlanFingerprint = {
  digest(canonicalTerms: string): Promise<string>;
};

export type PlanVersionIdentifierFactory = {
  create(): PlanVersionId;
};

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  const source = value as Record<string, unknown>;
  return `{${Object.keys(source)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalize(source[key])}`)
    .join(",")}}`;
}

function validCapabilityValue(definition: CapabilityDefinition, value: unknown): boolean {
  return definition.kind === "boolean"
    ? typeof value === "boolean"
    : typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

export function validatePlanTerms<TCatalog extends CapabilityCatalog>(input: {
  catalog: TCatalog;
  terms: PlanTerms<TCatalog>;
}): void {
  if (!/^[A-Z]{3}$/.test(input.terms.currency)) {
    throw new Error("Plan currency must be a three-letter uppercase code.");
  }
  if (!Number.isSafeInteger(input.terms.priceMinor) || input.terms.priceMinor < 0) {
    throw new Error("Plan price must be a non-negative safe integer in minor units.");
  }
  const catalogKeys = Object.keys(input.catalog).sort();
  const valueKeys = Object.keys(input.terms.capabilities).sort();
  if (catalogKeys.join("\u0000") !== valueKeys.join("\u0000")) {
    throw new Error("Plan capabilities must exactly match the capability catalog.");
  }
  for (const key of catalogKeys) {
    const definition = input.catalog[key];
    if (!definition || !validCapabilityValue(definition, input.terms.capabilities[key])) {
      throw new Error(`Invalid plan capability value: ${key}`);
    }
  }
}

export function canonicalPlanTerms<TCatalog extends CapabilityCatalog>(input: {
  catalog: TCatalog;
  terms: PlanTerms<TCatalog>;
}): string {
  validatePlanTerms(input);
  return canonicalize(input.terms);
}

export async function publishPlanVersion<TCatalog extends CapabilityCatalog>(input: {
  catalog: TCatalog;
  fingerprint: PlanFingerprint;
  identifiers: PlanVersionIdentifierFactory;
  latest: PublishedPlanVersion<TCatalog> | null;
  now: Date;
  planId: PlanId;
  terms: PlanTerms<TCatalog>;
}): Promise<
  | { readonly action: "unchanged"; readonly version: PublishedPlanVersion<TCatalog> }
  | { readonly action: "published"; readonly version: PublishedPlanVersion<TCatalog> }
> {
  if (input.latest && input.latest.planId !== input.planId) {
    throw new Error("Latest plan version belongs to another plan.");
  }
  const canonicalTerms = canonicalPlanTerms({ catalog: input.catalog, terms: input.terms });
  const fingerprint = await input.fingerprint.digest(canonicalTerms);
  if (!fingerprint) throw new Error("Plan fingerprint cannot be empty.");
  if (input.latest?.fingerprint === fingerprint) {
    return { action: "unchanged", version: input.latest };
  }
  const capabilities = Object.freeze({ ...input.terms.capabilities });
  const terms = Object.freeze({ ...input.terms, capabilities }) as PlanTerms<TCatalog>;
  return {
    action: "published",
    version: Object.freeze({
      fingerprint,
      id: input.identifiers.create(),
      planId: input.planId,
      publishedAt: new Date(input.now),
      terms,
      version: (input.latest?.version ?? 0) + 1,
    }),
  };
}
