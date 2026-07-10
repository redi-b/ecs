const apiUrl = process.env.DOKPLOY_API_URL?.replace(/\/$/, "");
const apiKey = process.env.DOKPLOY_API_KEY;
const composeId = process.env.DOKPLOY_COMPOSE_ID;

if (!apiKey) {
  console.log("DOKPLOY_API_KEY is not configured; deployment skipped.");
  process.exit(0);
}

if (!apiUrl || !composeId) {
  throw new Error(
    "DOKPLOY_API_URL and DOKPLOY_COMPOSE_ID are required when DOKPLOY_API_KEY is configured.",
  );
}

const response = await fetch(`${apiUrl}/api/compose.deploy`, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    "x-api-key": apiKey,
  },
  body: JSON.stringify({
    composeId,
    title: `GitHub Actions ${process.env.GITHUB_SHA?.slice(0, 7) ?? "deployment"}`,
  }),
  signal: AbortSignal.timeout(30_000),
});

if (!response.ok) {
  const body = (await response.text()).slice(0, 500);
  throw new Error(`Dokploy deployment failed (${response.status}): ${body}`);
}

console.log("Dokploy deployment triggered.");
