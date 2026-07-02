import { ModuleProvider, Modules } from "@medusajs/framework/utils";
import ChapaPaymentProviderService from "./service";

export default ModuleProvider(Modules.PAYMENT, {
  services: [ChapaPaymentProviderService],
});
