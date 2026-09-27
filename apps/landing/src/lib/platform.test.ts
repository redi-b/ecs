import assert from "node:assert/strict";
import test from "node:test";

import { getDashboardUrls, getPlatformApiUrl } from "./platform";

test("uses runtime service URLs so one image can serve every deployment", () => {
  const previousApi = process.env.PLATFORM_API_BASE_URL;
  const previousDashboard = process.env.PUBLIC_DASHBOARD_URL;
  process.env.PLATFORM_API_BASE_URL = "https://api.example.com/";
  process.env.PUBLIC_DASHBOARD_URL = "https://app.example.com/";

  try {
    assert.equal(getPlatformApiUrl(), "https://api.example.com");
    assert.deepEqual(getDashboardUrls(), {
      dashboard: "https://app.example.com/dashboard",
      demo: "https://app.example.com/demo",
      signIn: "https://app.example.com/sign-in",
      signUp: "https://app.example.com/sign-up",
    });
  } finally {
    if (previousApi === undefined) delete process.env.PLATFORM_API_BASE_URL;
    else process.env.PLATFORM_API_BASE_URL = previousApi;
    if (previousDashboard === undefined) delete process.env.PUBLIC_DASHBOARD_URL;
    else process.env.PUBLIC_DASHBOARD_URL = previousDashboard;
  }
});
