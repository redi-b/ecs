/**
 * Barrel for storefront visual editor UI modules.
 * Prefer importing from the focused modules when adding new code:
 * - editor-chrome: shell, toolbar, badges, Puck data override
 * - editor-settings: settings panel + field controls + media pickers
 * - editor-theme: appearance / palette / fonts
 * - editor-merchandising: collection & product pickers
 * - editor-preview: classic template preview + inline editables
 * - editor-puck: Puck config / field adapters
 * - editor-state / editor-utils / editor-config: pure state & helpers
 */
export {
  PuckDataOverride,
  PublicationStatusBadge,
  ShopLiveStatusBadge,
  StorefrontEditorActions,
  StorefrontEditorShell,
  ToolbarIconButton,
} from "./editor-chrome";

export {
  EditorImageSourceActions,
  ImageReferenceControl,
  StorefrontSettingControl,
  StorefrontSettingsPanel,
} from "./editor-settings";

export {
  buildPuckConfig,
  buildPuckFields,
  type PuckCustomFieldProps,
  VisualEditorField,
} from "./editor-puck";

export {
  ClassicV1StorefrontPreview,
  EditableHint,
  EditableImage,
  EditableText,
  TemplatePreview,
  UnsupportedTemplatePreview,
} from "./editor-preview";

export {
  getErrorMessage,
  isHexColor,
  preventPreviewLink,
  updateStorefrontProp,
  updateStorefrontProps,
} from "./editor-utils";

export { FontSelect, PremiumColorPicker, ThemeBrandSection } from "./editor-theme";

export { StorefrontCollectionPicker, StorefrontProductsPicker } from "./editor-merchandising";
