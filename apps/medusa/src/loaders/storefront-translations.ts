import type { ITranslationModuleService, LoaderOptions } from "@medusajs/framework/types";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";

const requestedSettings = {
  product: ["title", "subtitle", "description", "material"],
  product_variant: ["title", "material"],
  product_option: ["title"],
  product_option_value: ["value"],
  product_category: ["name", "description"],
  product_collection: ["title"],
} as const;

/** Keep customer-facing translation fields deterministic across every environment. */
export default async function storefrontTranslationsLoader({ container }: LoaderOptions) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const service = container.resolve<ITranslationModuleService>(Modules.TRANSLATION);
  const available = await service.getTranslatableFields();
  const existing = await service.listTranslationSettings({}, { take: 100 });
  const byEntity = new Map(existing.map((setting) => [setting.entity_type, setting]));

  const create: Array<{ entity_type: string; fields: string[]; is_active: boolean }> = [];
  const update: Array<{ id: string; fields: string[]; is_active: boolean }> = [];

  for (const [entityType, requestedFields] of Object.entries(requestedSettings)) {
    const supported = new Set(available[entityType] ?? []);
    const fields = requestedFields.filter((field) => supported.has(field));
    if (fields.length === 0) {
      logger.warn(`Storefront translations skipped unsupported entity ${entityType}`);
      continue;
    }
    const current = byEntity.get(entityType);
    if (current) {
      const unchanged =
        current.is_active &&
        current.fields.length === fields.length &&
        fields.every((field) => current.fields.includes(field));
      if (!unchanged) update.push({ id: current.id, fields, is_active: true });
    } else {
      create.push({ entity_type: entityType, fields, is_active: true });
    }
  }

  if (create.length) await service.createTranslationSettings(create);
  if (update.length) await service.updateTranslationSettings(update);
  logger.info("Storefront translation settings are ready");
}
