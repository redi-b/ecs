import { defineConfig, loadEnv } from "@medusajs/framework/utils";

loadEnv(process.env.NODE_ENV || "development", process.cwd());

module.exports = defineConfig({
  admin: {
    disable: process.env.DISABLE_MEDUSA_ADMIN === "true",
  },
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL || "postgres://ecs:ecs@localhost:5432/medusa_db",
    workerMode: (process.env.MEDUSA_WORKER_MODE || process.env.WORKER_MODE || "shared") as
      | "server"
      | "worker"
      | "shared",
    http: {
      storeCors: process.env.STORE_CORS || "http://*.lvh.me,http://localhost:4321",
      adminCors: process.env.ADMIN_CORS || "http://dashboard.lvh.me,http://localhost:3001",
      authCors: process.env.AUTH_CORS || "http://dashboard.lvh.me,http://localhost:3001",
      jwtSecret: process.env.JWT_SECRET || "development-jwt-secret",
      cookieSecret: process.env.COOKIE_SECRET || "development-cookie-secret",
    },
  },
});
