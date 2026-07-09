/**
 * Product catalog module.
 * Backed by the Medusa product adapter; routes should depend on this surface.
 */
export {
  createMedusaProductService,
  createMedusaProductService as createProductCatalog,
} from "../../adapters/medusa/product/index.js";
