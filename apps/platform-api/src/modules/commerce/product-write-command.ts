import type { PlatformAppOptions } from "../../app.js";
import { getProductMediaReferences } from "../media/product-references.js";

type ProductWriteResult = Awaited<
  ReturnType<
    | NonNullable<PlatformAppOptions["createMerchantProduct"]>
    | NonNullable<PlatformAppOptions["updateMerchantProduct"]>
  >
>;

type ProductWriteCommandOptions = {
  getProduct?: PlatformAppOptions["getMerchantProduct"];
  syncProductMedia?: PlatformAppOptions["syncProductMedia"];
  write: () => Promise<ProductWriteResult>;
};

export async function runProductWriteCommand(
  options: ProductWriteCommandOptions,
  input: {
    productId?: string;
    salesChannelId: string;
    synchronizeMedia: boolean;
    tenantId: string;
  },
): Promise<{
  mediaSyncWarning: boolean;
  result: ProductWriteResult;
}> {
  const result = await options.write();

  if (!result.ok || !input.synchronizeMedia) {
    return {
      mediaSyncWarning: false,
      result,
    };
  }

  if (!options.getProduct || !options.syncProductMedia) {
    return {
      mediaSyncWarning: true,
      result,
    };
  }

  const productId = input.productId ?? result.product.id;

  try {
    const latest = await options.getProduct({
      productId,
      salesChannelId: input.salesChannelId,
    });

    if (!latest.ok) {
      return {
        mediaSyncWarning: true,
        result,
      };
    }

    await options.syncProductMedia({
      ...getProductMediaReferences(latest.product),
      productId,
      tenantId: input.tenantId,
    });

    return {
      mediaSyncWarning: false,
      result,
    };
  } catch (error) {
    console.error("Product media sync failed after save", error);

    return {
      mediaSyncWarning: true,
      result,
    };
  }
}
