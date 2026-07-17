import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";

export {
  DEFAULT_AUTH_COOKIE_PREFIX,
  LEGACY_AUTH_COOKIE_PREFIX,
  getAuthCookiePrefix,
  getAuthSessionCookieBaseName,
  getAuthSessionCookieNames,
  getAuthSessionCookieNamesToClear,
} from "./auth-cookies";

export const serviceEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  SERVICE_NAME: z.string().min(1).default("ecs-service"),
});

export type ServiceEnv = z.infer<typeof serviceEnvSchema>;

export function loadServiceEnv(env: NodeJS.ProcessEnv = process.env): ServiceEnv {
  return serviceEnvSchema.parse(env);
}

export function loadServiceEnvFiles(
  options: { cwd?: string | undefined; serviceDir?: string | undefined } = {},
) {
  const cwd = options.cwd ?? process.cwd();
  const serviceDir = options.serviceDir ?? cwd;
  const envFiles = [resolve(cwd, ".env"), resolve(serviceDir, ".env")];
  const loaded: string[] = [];

  for (const envFile of envFiles) {
    if (!existsSync(envFile)) {
      continue;
    }

    process.loadEnvFile(envFile);
    loaded.push(envFile);
  }

  return loaded;
}
