import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

test("custom-domain overlay mounts only owned routing state and exposes no gateway or API ports", () => {
  const root = fileURLToPath(new URL("../", import.meta.url));
  const config = JSON.parse(
    execFileSync(
      "docker",
      [
        "compose",
        "--env-file",
        "infra/dokploy/.env.example",
        "-f",
        "infra/dokploy/docker-compose.yml",
        "-f",
        "infra/dokploy/custom-domains.compose.yml",
        "config",
        "--format",
        "json",
      ],
      {
        cwd: root,
        env: {
          ...process.env,
          ECS_DOMAIN_ROUTE_HOST_DIRECTORY: "/etc/dokploy/traefik/dynamic/ecs-custom-domains",
          ECS_DOMAIN_INGRESS_IPV4: "178.238.224.27",
        },
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      },
    ),
  );
  for (const name of ["platform-api", "platform-worker"]) {
    const service = config.services[name];
    assert.equal(service.environment.ECS_CUSTOM_DOMAINS_ENABLED, "false");
    assert.equal(service.environment.ECS_DOMAIN_ROUTE_DIRECTORY, "/var/lib/ecs-domain-routes");
    assert.equal(
      service.environment.ECS_DOMAIN_STOREFRONT_SERVICE,
      "ecs-custom-domains-storefront@file",
    );
    assert.equal(service.environment.ECS_DOMAIN_TRAEFIK_API_URL, "http://dokploy-traefik:8080");
    assert.equal(service.ports, undefined);
    assert.ok(service.networks.default);
    assert.ok(service.networks["dokploy-network"]);
    assert.deepEqual(service.volumes, [
      {
        type: "bind",
        source: "/etc/dokploy/traefik/dynamic/ecs-custom-domains",
        target: "/var/lib/ecs-domain-routes",
        bind: { create_host_path: false },
      },
    ]);
  }
  const gateway = config.services["custom-domain-gateway"];
  assert.equal(gateway.image, "caddy:2.10-alpine");
  assert.equal(gateway.user, "1000:1000");
  assert.equal(gateway.read_only, true);
  assert.equal(gateway.labels["traefik.enable"], "false");
  assert.equal(gateway.ports, undefined);
  assert.deepEqual(gateway.networks["dokploy-network"].aliases, ["ecs-custom-domain-gateway"]);
  assert.equal(gateway.volumes.length, 1);
  assert.equal(gateway.volumes[0].read_only, true);
});
