import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/schema/index.ts",
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: {
    url:
      process.env.PLATFORM_DATABASE_URL ??
      `postgres://ecs:ecs@localhost:${process.env.POSTGRES_HOST_PORT ?? "5432"}/platform_db`,
  },
});
