/**
 * Barrel for storefront visual editor UI modules.
 * Prefer importing from the focused modules when adding new code:
 * - editor-chrome: shell, toolbar, badges
 * - editor-settings: settings panel + field controls + media pickers
 * - editor-theme: appearance / palette / fonts
 * - editor-merchandising: collection & product pickers
 * - editor-preview: iframe preview + inline editing controls
 * - editor-state / editor-utils / editor-config: pure state & helpers
 */
export {
  PublicationStatusBadge,
  ShopLiveStatusBadge,
  StorefrontEditorActions,
  StorefrontEditorShell,
  ToolbarIconButton,
} from "./editor-chrome";
export { StorefrontCollectionPicker, StorefrontProductsPicker } from "./editor-merchandising";

export {
  EditableHint,
  EditableImage,
  EditableText,
  TemplatePreview,
  UnsupportedTemplatePreview,
} from "./editor-preview";
export {
  EditorImageSourceActions,
  ImageReferenceControl,
  StorefrontSettingControl,
  StorefrontSettingsPanel,
} from "./editor-settings";

export { ColorPickerField, ThemeBrandSection } from "./editor-theme";
export {
  getErrorMessage,
  isHexColor,
  preventPreviewLink,
  updateStorefrontProp,
  updateStorefrontProps,
} from "./editor-utils";
