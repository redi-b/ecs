const endpoint = process.env.MEDIA_S3_PUBLIC_BASE_URL ?? "http://127.0.0.1:9002/ecs-media";
const origin = process.env.MEDIA_CORS_TEST_ORIGIN ?? "http://shop.lvh.me";
const target = `${endpoint.replace(/\/$/, "")}/verification/cors.txt`;
const response = await fetch(target, {
  headers: {
    "access-control-request-headers": "content-type",
    "access-control-request-method": "PUT",
    origin,
  },
  method: "OPTIONS",
});
const allowedOrigin = response.headers.get("access-control-allow-origin");
const allowedMethods = response.headers.get("access-control-allow-methods") ?? "";

if (!response.ok || !allowedOrigin || !allowedMethods.includes("PUT")) {
  console.error(
    `Media CORS check failed: status=${response.status} origin=${allowedOrigin ?? "missing"} methods=${allowedMethods || "missing"}`,
  );
  process.exit(1);
}

console.log(`Media CORS ready for ${origin}: ${allowedMethods}`);
