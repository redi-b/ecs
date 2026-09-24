import assert from "node:assert/strict";
import test from "node:test";
import { createMediaProcessHandler } from "./media-process.js";

function fixture() {
  const asset = {
    id: "asset_1",
    tenantId: "tenant_1",
    status: "ready",
    variantsStatus: "ready",
    mimeType: "image/jpeg",
    objectKey: "s/tenant_1/asset_1/photo.jpg",
    publicUrl: "https://media.example/photo.jpg",
    width: 1600,
    height: 1200,
    variants: {
      w200: {
        publicUrl: "https://media.example/photo-200.webp",
        objectKey: "photo-200.webp",
        byteSize: 50,
        width: 200,
        height: 150,
      },
    },
  };
  function query(rows: unknown[]) {
    return {
      from() {
        return this;
      },
      where() {
        return this;
      },
      innerJoin() {
        return this;
      },
      orderBy() {
        return Promise.resolve(rows);
      },
      limit() {
        return Promise.resolve(rows);
      },
      then(resolve: (value: unknown[]) => unknown) {
        return Promise.resolve(rows).then(resolve);
      },
    };
  }
  const db = {
    select(fields?: Record<string, unknown>) {
      return query(
        !fields
          ? [asset]
          : "resourceId" in fields
            ? [{ resourceId: "prod_1" }, { resourceId: "prod_1" }]
            : [{ asset }],
      );
    },
    update() {
      return {
        set(values: Partial<typeof asset>) {
          return {
            where: async () => {
              Object.assign(asset, values);
              return [];
            },
          };
        },
      };
    },
  } as unknown as Parameters<typeof createMediaProcessHandler>[0]["db"];
  let reads = 0;
  const storage = {
    getObject: async () => {
      reads++;
      return null;
    },
  } as unknown as Parameters<typeof createMediaProcessHandler>[0]["storage"];
  return { asset, db, storage, reads: () => reads };
}
async function run(handler: ReturnType<typeof createMediaProcessHandler>) {
  return handler({ payload: { assetId: "asset_1" } } as Parameters<typeof handler>[0]);
}

test("already-generated derivatives still publish metadata without reprocessing the original", async () => {
  const f = fixture();
  const calls: unknown[] = [];
  const handler = createMediaProcessHandler({
    db: f.db,
    storage: f.storage,
    updateProductMediaVariants: async (input) => {
      calls.push(input);
      return { ok: true };
    },
  });
  await run(handler);
  assert.equal(f.reads(), 0);
  assert.deepEqual(calls, [
    {
      productId: "prod_1",
      tenantId: "tenant_1",
      mediaVariants: {
        "https://media.example/photo.jpg": { w200: "https://media.example/photo-200.webp" },
      },
    },
  ]);
});

test("failed metadata publication retries without regenerating completed derivatives", async () => {
  const f = fixture();
  let calls = 0;
  const handler = createMediaProcessHandler({
    db: f.db,
    storage: f.storage,
    updateProductMediaVariants: async () => (++calls === 1 ? { ok: false } : { ok: true }),
  });
  await assert.rejects(run(handler), /media_process_failed/);
  assert.equal(f.asset.variantsStatus, "ready");
  await run(handler);
  assert.equal(calls, 2);
  assert.equal(f.reads(), 0);
});

test("an unavailable original fails for retry instead of permanently skipping optimization", async () => {
  const f = fixture();
  f.asset.variantsStatus = "pending";
  await assert.rejects(run(createMediaProcessHandler(f)), /media_process_failed/);
  assert.equal(f.asset.variantsStatus, "failed");
  assert.equal(f.reads(), 1);
});

test("unconfirmed and deleted uploads are never processed", async () => {
  for (const status of ["pending", "deleted"]) {
    const f = fixture();
    f.asset.status = status;
    await run(createMediaProcessHandler(f));
    assert.equal(f.reads(), 0);
  }
});
