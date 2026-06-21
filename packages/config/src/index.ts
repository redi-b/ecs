import { z } from "zod";

export const serviceEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  SERVICE_NAME: z.string().min(1).default("ecs-service"),
});

export type ServiceEnv = z.infer<typeof serviceEnvSchema>;

export function loadServiceEnv(env: NodeJS.ProcessEnv = process.env): ServiceEnv {
  return serviceEnvSchema.parse(env);
}
