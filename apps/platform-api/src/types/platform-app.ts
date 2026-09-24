import type { PlatformAdministrationOptions } from "./platform-administration-options.js";
import type { PlatformCatalogOptions } from "./platform-catalog-options.js";
import type { PlatformMerchantOperationsOptions } from "./platform-merchant-operations-options.js";
import type { PlatformResourceOptions } from "./platform-resource-options.js";
import type { PlatformStorefrontOptions } from "./platform-storefront-options.js";

export type PlatformAppOptions = PlatformAdministrationOptions &
  PlatformStorefrontOptions &
  PlatformCatalogOptions &
  PlatformMerchantOperationsOptions &
  PlatformResourceOptions;

export type PlatformAppVariables = {
  requestId: string;
};
