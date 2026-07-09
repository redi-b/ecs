export {
  createPlatformHeaders,
  createPlatformUrl,
  getMerchantResourcePath,
  getPlatformApiBaseUrl,
  normalizeBaseUrl,
  platformFetch,
  type PlatformRequestContext,
} from "./client";

export {
  getRequestOrigin,
  redirectWithStatus,
  withMerchantAction,
  type MerchantActionContext,
  type MerchantActionResult,
} from "./action-route";

export { mapPlatformErrorMessage, isKnownPlatformErrorCode } from "./errors";
