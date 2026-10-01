import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { request as httpRequest } from "node:http";
import { request } from "node:https";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { createDomainRoutePublisher } from "../apps/platform-api/src/modules/domains/route-publisher.ts";
import { createTraefikRouteVerifier } from "../apps/platform-api/src/modules/domains/traefik-verifier.ts";
import { renderDomainRoutes } from "./custom-domain-routing.mjs";

const image = "traefik@sha256:31267173a15b4944e797a76ffd9c419707c8d8b32fe5b610f80cd0cfa05f372d";
const hostname = "pilot.example.com";
const options = { service: "ecs-custom-domains-storefront@file", resolver: "local-test" };
const docker = (...args) =>
  execFileSync("docker", args, { encoding: "utf8", timeout: 30_000 }).trim();

async function until(check) {
  let lastError;
  for (let attempt = 0; attempt < 40; attempt++) {
    try {
      return await check();
    } catch (error) {
      lastError = error;
    }
    await delay(250);
  }
  throw lastError;
}

function httpsGet(port, host, path = "/") {
  // Routing-only test: the isolated instance intentionally uses a self-signed
  // fallback. This is NOT a certificate issuance or trust acceptance test.
  return new Promise((resolve, reject) => {
    const req = request(
      {
        hostname: "127.0.0.1",
        port,
        path,
        servername: host,
        headers: { Host: host },
        rejectUnauthorized: false,
        timeout: 2_000,
      },
      (res) => {
        let body = "";
        res.on("data", (chunk) => {
          body += chunk;
        });
        res.on("end", () => resolve({ status: res.statusCode, body }));
      },
    );
    req.on("error", reject);
    req.on("timeout", () => req.destroy(new Error("Probe timed out")));
    req.end();
  });
}

test(
  "Traefik 3.6.25 preserves Host, hot-reloads exact routes, withdraws, restores and survives restart",
  {
    skip: process.env.ECS_DOMAIN_DOCKER_TEST !== "1",
    timeout: 120_000,
  },
  async (t) => {
    const suffix = randomUUID().slice(0, 8);
    const network = `ecs-domain-test-${suffix}`;
    const backend = `${network}-backend`;
    const gateway = `${network}-gateway`;
    const ingress = `${network}-ingress`;
    const directory = await mkdtemp(join(tmpdir(), "ecs-domain-test-"));
    let networkCreated = false;
    let backendCreated = false;
    let gatewayCreated = false;
    let ingressCreated = false;
    let passed = false;
    t.after(async () => {
      if (!passed && ingressCreated) t.diagnostic(docker("logs", "--tail", "20", ingress));
      if (ingressCreated) docker("rm", "-f", ingress);
      if (gatewayCreated) docker("rm", "-f", gateway);
      if (backendCreated) docker("rm", "-f", backend);
      if (networkCreated) docker("network", "rm", network);
      await rm(directory, { recursive: true, force: true });
    });
    const dynamic = join(directory, "dynamic");
    await mkdir(dynamic);
    await writeFile(
      join(directory, "Caddyfile"),
      '{\n  auto_https off\n}\n:4321 {\n  respond "{host}"\n}\n',
    );
    await writeFile(
      join(dynamic, "backend.yml"),
      await readFile(
        new URL("../infra/dokploy/custom-domains/backend.yml", import.meta.url),
        "utf8",
      ),
    );
    await writeFile(
      join(directory, "GatewayCaddyfile"),
      await readFile(new URL("../infra/dokploy/custom-domains/Caddyfile", import.meta.url), "utf8"),
    );
    // Production gives ECS ownership of its own child directory, never the
    // whole Dokploy directory containing ACME state or unrelated applications.
    const routeDirectory = join(dynamic, "ecs-custom-domains");
    await mkdir(routeDirectory);
    const publisher = createDomainRoutePublisher({ directory: routeDirectory });
    // Bootstrap empty config before the live provider starts.
    await publisher.publish(renderDomainRoutes([], options), async () => {});
    docker("network", "create", network);
    networkCreated = true;
    docker(
      "run",
      "-d",
      "--name",
      backend,
      "--network",
      network,
      "--network-alias",
      "ecs-storefront",
      "--read-only",
      "--tmpfs",
      "/config",
      "--tmpfs",
      "/data",
      "--mount",
      `type=bind,src=${join(directory, "Caddyfile")},dst=/etc/caddy/Caddyfile,readonly`,
      "caddy:2.10-alpine",
    );
    backendCreated = true;
    docker(
      "run",
      "-d",
      "--name",
      gateway,
      "--network",
      network,
      "--network-alias",
      "ecs-custom-domain-gateway",
      "--user",
      "1000:1000",
      "--read-only",
      "--cap-drop",
      "ALL",
      "--cap-add",
      "NET_BIND_SERVICE",
      "--security-opt",
      "no-new-privileges:true",
      "--tmpfs",
      "/config:uid=1000,gid=1000",
      "--tmpfs",
      "/data:uid=1000,gid=1000",
      "--mount",
      `type=bind,src=${join(directory, "GatewayCaddyfile")},dst=/etc/caddy/Caddyfile,readonly`,
      "caddy:2.10-alpine",
    );
    gatewayCreated = true;
    docker(
      "run",
      "-d",
      "--name",
      ingress,
      "--network",
      network,
      "--read-only",
      "--tmpfs",
      "/tmp",
      "-p",
      "127.0.0.1::8080",
      "-p",
      "127.0.0.1::8443",
      "-p",
      "127.0.0.1::9000",
      "--mount",
      `type=bind,src=${dynamic},dst=/dynamic,readonly`,
      image,
      "--providers.file.directory=/dynamic",
      "--providers.file.watch=true",
      "--entrypoints.web.address=:8080",
      "--entrypoints.websecure.address=:8443",
      "--api.insecure=true",
      "--entrypoints.traefik.address=:9000",
      // Never contact a public CA from this fixture: use an unreachable loopback
      // CA URL. Persistence below is routing, not ACME. Published test ports are
      // restricted to host loopback and no Docker socket is mounted.
      "--certificatesresolvers.local-test.acme.email=test@example.com",
      "--certificatesresolvers.local-test.acme.storage=/tmp/acme.json",
      "--certificatesresolvers.local-test.acme.caserver=http://127.0.0.1:1/directory",
      "--certificatesresolvers.local-test.acme.httpchallenge.entrypoint=web",
    );
    ingressCreated = true;
    const bindings = JSON.parse(
      docker("inspect", ingress, "--format", "{{json .NetworkSettings.Ports}}"),
    );
    const httpPort = bindings["8080/tcp"][0].HostPort;
    let httpsPort = bindings["8443/tcp"][0].HostPort;
    const apiBaseUrl = `http://127.0.0.1:${bindings["9000/tcp"][0].HostPort}`;
    const verifyRoutes = createTraefikRouteVerifier({ apiBaseUrl, routeOptions: options });
    const httpGet = (host) =>
      new Promise((resolve, reject) => {
        const req = httpRequest(
          {
            hostname: "127.0.0.1",
            port: httpPort,
            path: "/",
            headers: { Host: host },
            timeout: 2_000,
          },
          (res) => {
            res.resume();
            res.on("end", () => resolve({ status: res.statusCode, headers: res.headers }));
          },
        );
        req.on("error", reject);
        req.on("timeout", () => req.destroy(new Error("HTTP probe timed out")));
        req.end();
      });
    await until(async () => assert.equal((await httpGet(hostname)).status, 404));
    await verifyRoutes([]);
    // Negative control: a missing router must fail the normal acceptance assertion.
    await assert.rejects(async () => assert.equal((await httpGet(hostname)).status, 301));
    const routes = renderDomainRoutes([hostname], options);
    await publisher.publish(routes, async () => {
      await verifyRoutes([hostname]);
      await until(async () => {
        const response = await httpGet(hostname);
        assert.equal(response.status, 301);
        assert.equal(response.headers.location, `https://${hostname}/`);
      });
    });
    await until(async () =>
      assert.deepEqual(await httpsGet(httpsPort, hostname), { status: 200, body: hostname }),
    );
    assert.equal((await httpGet("unknown.example.com")).status, 404);
    assert.equal((await httpsGet(httpsPort, "unknown.example.com")).status, 404);
    for (const path of ["/platform/tenants", "/dashboard", "/auth/session", "/ops"])
      assert.equal((await httpsGet(httpsPort, hostname, path)).status, 404);
    await publisher.publish(renderDomainRoutes([], options), async () => {
      await verifyRoutes([]);
      await until(async () => assert.equal((await httpsGet(httpsPort, hostname)).status, 404));
    });
    await publisher.publish(routes, async () => {
      await verifyRoutes([hostname]);
      await until(async () => assert.equal((await httpsGet(httpsPort, hostname)).body, hostname));
    });
    await assert.rejects(
      publisher.publish("http:\n  routers: [invalid]\n", async () => {
        await until(() =>
          assert.match(
            docker("logs", "--tail", "30", ingress),
            /(?:cannot|unmarshal|decode).*ecs-custom-domains\.yml|ecs-custom-domains\.yml.*(?:cannot|unmarshal|decode)/is,
          ),
        );
        await createTraefikRouteVerifier({
          apiBaseUrl,
          routeOptions: options,
          timeoutMs: 250,
          pollMs: 25,
        })([hostname, "rejected.example.com"]);
      }),
      /not accepted/,
    );
    assert.equal(await readFile(join(routeDirectory, "ecs-custom-domains.yml"), "utf8"), routes);
    await until(async () => assert.equal((await httpsGet(httpsPort, hostname)).body, hostname));
    await verifyRoutes([hostname]);
    docker("restart", ingress);
    const restartedBindings = JSON.parse(
      docker("inspect", ingress, "--format", "{{json .NetworkSettings.Ports}}"),
    );
    httpsPort = restartedBindings["8443/tcp"][0].HostPort;
    await until(async () =>
      assert.deepEqual(await httpsGet(httpsPort, hostname), { status: 200, body: hostname }),
    );
    passed = true;
  },
);
