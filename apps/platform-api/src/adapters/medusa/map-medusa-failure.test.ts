import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  commerceErrorStatus,
  mapMedusaFailure,
  mapMedusaHttpFailure,
} from "./map-medusa-failure.js";

describe("mapMedusaHttpFailure", () => {
  it("maps missing response to 503", () => {
    assert.deepEqual(mapMedusaHttpFailure(null), {
      ok: false,
      error: "commerce_backend_unavailable",
      status: 503,
    });
  });

  it("maps 401/403 to commerce_credentials_invalid", () => {
    assert.deepEqual(mapMedusaHttpFailure(new Response(null, { status: 401 })), {
      ok: false,
      error: "commerce_credentials_invalid",
      status: 401,
    });
    assert.deepEqual(mapMedusaHttpFailure(new Response(null, { status: 403 })), {
      ok: false,
      error: "commerce_credentials_invalid",
      status: 401,
    });
  });

  it("maps 404 with notFoundError", () => {
    assert.deepEqual(
      mapMedusaHttpFailure(new Response(null, { status: 404 }), {
        notFoundError: "product_not_found",
      }),
      {
        ok: false,
        error: "product_not_found",
        status: 404,
      },
    );
  });

  it("maps 400/422 to invalidError at 400 — never 503", () => {
    assert.deepEqual(
      mapMedusaHttpFailure(new Response(null, { status: 400 }), {
        invalidError: "product_write_invalid",
      }),
      {
        ok: false,
        error: "product_write_invalid",
        status: 400,
      },
    );
    assert.deepEqual(
      mapMedusaHttpFailure(new Response(null, { status: 422 }), {
        invalidError: "invalid_promotion",
      }),
      {
        ok: false,
        error: "invalid_promotion",
        status: 400,
      },
    );
  });

  it("maps 409 with conflictError", () => {
    assert.deepEqual(
      mapMedusaHttpFailure(new Response(null, { status: 409 }), {
        conflictError: "product_conflict",
        invalidError: "product_write_invalid",
      }),
      {
        ok: false,
        error: "product_conflict",
        status: 409,
      },
    );
  });

  it("maps other 4xx to invalidError at 400", () => {
    assert.deepEqual(
      mapMedusaHttpFailure(new Response(null, { status: 415 }), {
        invalidError: "invalid_manual_order",
      }),
      {
        ok: false,
        error: "invalid_manual_order",
        status: 400,
      },
    );
  });

  it("maps 5xx to 503", () => {
    assert.deepEqual(mapMedusaHttpFailure(new Response(null, { status: 502 })), {
      ok: false,
      error: "commerce_backend_unavailable",
      status: 503,
    });
  });
});

describe("mapMedusaFailure", () => {
  it("refines validation messages from body", async () => {
    const response = Response.json(
      { message: "max_quantity is required when allocation is each" },
      { status: 400 },
    );
    const result = await mapMedusaFailure(response, {
      invalidError: "invalid_promotion",
      notFoundError: "promotion_not_found",
      refine: ({ blob }) => {
        if (blob.includes("max_quantity")) {
          return { error: "promotion_max_quantity_required", status: 400 };
        }
        return null;
      },
    });
    assert.deepEqual(result, {
      ok: false,
      error: "promotion_max_quantity_required",
      status: 400,
    });
  });

  it("keeps default when refine returns null", async () => {
    const response = Response.json({ message: "bad input" }, { status: 400 });
    const result = await mapMedusaFailure(response, {
      invalidError: "invalid_promotion",
      refine: () => null,
    });
    assert.deepEqual(result, {
      ok: false,
      error: "invalid_promotion",
      status: 400,
    });
  });
});

describe("commerceErrorStatus", () => {
  it("passes known statuses and clamps other 4xx to 400", () => {
    assert.equal(commerceErrorStatus(400), 400);
    assert.equal(commerceErrorStatus(409), 409);
    assert.equal(commerceErrorStatus(422), 422);
    assert.equal(commerceErrorStatus(415), 400);
    assert.equal(commerceErrorStatus(502), 503);
    assert.equal(commerceErrorStatus(200), 503);
  });
});
