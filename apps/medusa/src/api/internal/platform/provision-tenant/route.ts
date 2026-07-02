import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";

import {
  type ProvisionTenantCommerceResourcesInput,
  provisionTenantCommerceResourcesWorkflow,
} from "../../../../workflows/provision-tenant-commerce-resources";
import { findExistingTenantCommerceResources } from "./idempotency";

function getInternalToken(request: MedusaRequest) {
  return request.headers["x-platform-internal-token"];
}

function getExpectedInternalToken() {
  return (
    process.env.PLATFORM_INTERNAL_API_TOKEN ??
    (process.env.NODE_ENV === "production" ? undefined : "development-platform-internal-token")
  );
}

function isProvisionInput(value: unknown): value is ProvisionTenantCommerceResourcesInput {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const input = value as Record<string, unknown>;

  return (
    typeof input.handle === "string" &&
    input.handle.trim() !== "" &&
    typeof input.name === "string" &&
    input.name.trim() !== "" &&
    typeof input.platformTenantId === "string" &&
    input.platformTenantId.trim() !== "" &&
    typeof input.requestedByUserId === "string" &&
    input.requestedByUserId.trim() !== ""
  );
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const expectedToken = getExpectedInternalToken();

  if (!expectedToken || getInternalToken(req) !== expectedToken) {
    return res.status(401).json({
      error: "internal_auth_required",
    });
  }

  if (!isProvisionInput(req.body)) {
    return res.status(400).json({
      error: "invalid_provisioning_input",
    });
  }

  const input = {
    handle: req.body.handle.trim(),
    name: req.body.name.trim(),
    platformTenantId: req.body.platformTenantId.trim(),
    requestedByUserId: req.body.requestedByUserId.trim(),
  };

  const existingResources = await findExistingTenantCommerceResources({
    input,
    query: req.scope.resolve("query"),
  });

  if (existingResources) {
    return res.status(200).json({
      resources: existingResources,
    });
  }

  const { result } = await provisionTenantCommerceResourcesWorkflow(req.scope).run({ input });

  return res.status(201).json({
    resources: result,
  });
}
