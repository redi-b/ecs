/**
 * Order management module.
 * Backed by the Medusa order adapter; routes should depend on this surface.
 */
export {
  createMedusaOrderService,
  createMedusaOrderService as createOrderManagement,
} from "../../adapters/medusa/order/index.js";
