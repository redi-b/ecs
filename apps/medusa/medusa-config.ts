import { defineConfig, loadEnv } from "@medusajs/framework/utils";

loadEnv(process.env.NODE_ENV || "development", process.cwd());

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
const databaseSslEnabled = process.env.DATABASE_SSL === "true";

const paymentProviders = [
  {
    resolve: "./src/modules/chapa-payment",
    id: "chapa",
    options: {
      apiUrl: process.env.CHAPA_API_URL,
      callbackUrl: process.env.CHAPA_CALLBACK_URL,
      customizationDescription: process.env.CHAPA_CUSTOMIZATION_DESCRIPTION,
      customizationTitle: process.env.CHAPA_CUSTOMIZATION_TITLE,
      fallbackEmail: process.env.CHAPA_FALLBACK_EMAIL,
      returnUrl: process.env.CHAPA_RETURN_URL,
      secretKey: process.env.CHAPA_SECRET_KEY,
    },
  },
];

module.exports = defineConfig({
  admin: {
    disable: process.env.DISABLE_MEDUSA_ADMIN === "true",
  },
  plugins: [
    {
      resolve: "@medusajs/draft-order",
      options: {},
    },
  ],
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL || "postgres://ecs:ecs@localhost:5432/medusa_db",
    ...(databaseSslEnabled
      ? {}
      : {
          databaseDriverOptions: {
            ssl: false,
            sslmode: "disable",
          },
        }),
    redisUrl,
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
  modules: [
    {
      resolve: "@medusajs/medusa/event-bus-redis",
      options: {
        redisUrl,
      },
    },
    {
      resolve: "@medusajs/medusa/workflow-engine-redis",
      options: {
        redis: {
          redisUrl,
        },
      },
    },
    {
      resolve: "@medusajs/medusa/locking",
      options: {
        providers: [
          {
            resolve: "@medusajs/medusa/locking-redis",
            id: "locking-redis",
            is_default: true,
            options: {
              redisUrl,
            },
          },
        ],
      },
    },
    {
      resolve: "@medusajs/medusa/payment",
      options: {
        providers: paymentProviders,
      },
    },
  ],
});
