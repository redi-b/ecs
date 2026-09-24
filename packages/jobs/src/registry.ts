import type { z } from "zod";

export type JobQueueClass = "bulk" | "critical" | "default";
export type JobBackoffPolicy = {
  delayMs: number;
  jitter: number;
  type: "exponential" | "fixed";
};
export type JobRetentionPolicy = {
  completedSeconds: number;
  failedSeconds: number;
};
export type JobRetryClassification = "always" | "classified" | "never";

export type JobDefinition<TPayload = unknown, TResult = unknown> = {
  attempts: number;
  backoff: JobBackoffPolicy;
  idempotency: "optional" | "required";
  manualRetry: "never" | "safe";
  name: string;
  payloadSchema: z.ZodType<TPayload>;
  queue: JobQueueClass;
  resultSchema?: z.ZodType<TResult>;
  retention: JobRetentionPolicy;
  retry: JobRetryClassification;
  timeoutMs: number;
  version: number;
};

export function defineJob<TPayload, TResult = unknown>(
  definition: JobDefinition<TPayload, TResult>,
): JobDefinition<TPayload, TResult> {
  assertDefinitionPolicy(definition);
  return Object.freeze(definition);
}

export type JobRegistry = ReturnType<typeof createJobRegistry>;

export function createJobRegistry(definitions: readonly JobDefinition[]) {
  const byName = new Map<string, JobDefinition>();
  for (const definition of definitions) {
    assertDefinitionPolicy(definition);
    if (byName.has(definition.name)) {
      throw new Error(`Duplicate job definition: ${definition.name}`);
    }
    byName.set(definition.name, definition);
  }

  return Object.freeze({
    definitions: Object.freeze([...byName.values()]),
    get(name: string) {
      return byName.get(name);
    },
    require(name: string) {
      const definition = byName.get(name);
      if (!definition) throw new UnknownJobDefinitionError(name);
      return definition;
    },
    parsePayload(name: string, payload: unknown) {
      const definition = this.require(name);
      const parsed = definition.payloadSchema.safeParse(payload);
      if (!parsed.success) throw new InvalidJobPayloadError(name);
      return parsed.data;
    },
    parseResult(name: string, result: unknown) {
      const definition = this.require(name);
      if (!definition.resultSchema) return result;
      const parsed = definition.resultSchema.safeParse(result);
      if (!parsed.success) throw new InvalidJobResultError(name);
      return parsed.data;
    },
  });
}

export class UnknownJobDefinitionError extends Error {
  readonly code = "job_definition_unknown";
  constructor(name: string) {
    super(`Unknown job definition: ${name}`);
    this.name = "UnknownJobDefinitionError";
  }
}

export class InvalidJobPayloadError extends Error {
  readonly code = "job_payload_invalid";
  constructor(name: string) {
    super(`Invalid payload for job: ${name}`);
    this.name = "InvalidJobPayloadError";
  }
}

export class InvalidJobResultError extends Error {
  readonly code = "job_result_invalid";
  constructor(name: string) {
    super(`Invalid result for job: ${name}`);
    this.name = "InvalidJobResultError";
  }
}

function assertDefinitionPolicy(definition: JobDefinition) {
  if (!/^[a-z][a-z0-9.-]*$/.test(definition.name)) {
    throw new Error(`Invalid job definition name: ${definition.name}`);
  }
  if (!Number.isInteger(definition.version) || definition.version < 1) {
    throw new Error(`Invalid schema version for job: ${definition.name}`);
  }
  if (!Number.isInteger(definition.attempts) || definition.attempts < 1) {
    throw new Error(`Invalid attempts policy for job: ${definition.name}`);
  }
  if (!Number.isFinite(definition.timeoutMs) || definition.timeoutMs < 1) {
    throw new Error(`Invalid timeout policy for job: ${definition.name}`);
  }
  if (
    definition.backoff.delayMs < 0 ||
    definition.backoff.jitter < 0 ||
    definition.backoff.jitter > 1
  ) {
    throw new Error(`Invalid backoff policy for job: ${definition.name}`);
  }
  if (definition.retention.completedSeconds < 0 || definition.retention.failedSeconds < 0) {
    throw new Error(`Invalid retention policy for job: ${definition.name}`);
  }
}
