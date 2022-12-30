export enum PreferenceSettingId {
  General = 'general',
  Editor = 'editor',
  Terminal = 'terminal',
  Feature = 'feature',
  View = 'view',
}

export const knownPrefIdMappings = {
  'workbench.editor.enablePreview': 'editor.previewMode',
};
