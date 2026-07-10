export {
  getRequestOrigin,
  type MerchantActionContext,
  type MerchantActionResult,
  redirectWithStatus,
  withMerchantAction,
} from "./action-route";
export {
  createPlatformHeaders,
  createPlatformUrl,
  getMerchantResourcePath,
  getPlatformApiBaseUrl,
  normalizeBaseUrl,
  type PlatformRequestContext,
  platformFetch,
} from "./client";

export { isKnownPlatformErrorCode, mapPlatformErrorMessage } from "./errors";
