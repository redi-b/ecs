export { afroShop } from "./demo/afro-shop.js";
export { fashionShop } from "./demo/fashion-shop.js";
export { demoProductImages } from "./demo/product-images.js";
export { techShop } from "./demo/tech-shop.js";
export type {
  DemoCategory,
  DemoCustomer,
  DemoProduct,
  DemoProductImage,
  DemoProductOption,
  DemoProductVariant,
  DemoShopDefinition,
} from "./demo/types.js";

import { afroShop } from "./demo/afro-shop.js";
import { fashionShop } from "./demo/fashion-shop.js";
import { techShop } from "./demo/tech-shop.js";

export const DEMO_OPERATIONS = {
  approver: {
    email: "approvalsdemo@ecs.et",
    id: "d0000000-0000-4000-8000-000000000002",
    name: "ECS Access Approver",
  },
  operator: {
    email: "operationsdemo@ecs.et",
    id: "d0000000-0000-4000-8000-000000000001",
    name: "ECS Operations Demo",
  },
  principalId: "d0000000-0000-4000-8000-000000000101",
} as const;

export const DEMO_OPERATIONS_PASSWORD = process.env.SEED_OPERATIONS_PASSWORD ?? "operations1234";
export const DEMO_SEED_MARKER = "ecs-demo-v5";
export const DEMO_OWNER_PASSWORD = process.env.SEED_OWNER_PASSWORD ?? "password1234";
export const LEGACY_DEMO_HANDLES = ["addis-tech", "bole-style"] as const;
export const LEGACY_DEMO_EMAILS = ["owner@addis-tech.local"] as const;

export const demoShops = [techShop, fashionShop, afroShop] as const;
