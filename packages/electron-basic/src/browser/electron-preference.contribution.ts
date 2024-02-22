import { Domain, PreferenceContribution, PreferenceSchema, localize } from '@opensumi/ide-core-browser';

export const electronPreferencesSchema: PreferenceSchema = {
  type: 'object',
  properties: {
    'window.title': {
      type: 'string',
      description: localize('window.title'),
    },
  },
};

export const ElectronPreferences = Symbol('ElectronPreferences');

@Domain(PreferenceContribution)
export class ElectronPreferenceContribution implements PreferenceContribution {
  schema: PreferenceSchema = electronPreferencesSchema;
}
