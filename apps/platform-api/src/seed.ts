import { storefrontTemplates } from "@ecs/storefront-templates";

console.log(
  JSON.stringify(
    {
      seeded: {
        reservedHandles: 0,
        plans: 0,
        templates: storefrontTemplates.map((template) => template.templateKey),
      },
    },
    null,
    2,
  ),
);
