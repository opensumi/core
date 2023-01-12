import { PreferenceSchema, PreferenceContribution, localize, Domain } from '@opensumi/ide-core-browser';

import { DEFAULT_TEMPLATE } from './header/header.service';

export const electronPreferencesSchema: PreferenceSchema = {
  type: 'object',
  properties: {
    'window.title': {
      type: 'string',
      default: DEFAULT_TEMPLATE,
      description: localize('window.title'),
    },
  },
};

export const ElectronPreferences = Symbol('ElectronPreferences');

@Domain(PreferenceContribution)
export class ElectronPreferenceContribution implements PreferenceContribution {
  schema: PreferenceSchema = electronPreferencesSchema;
}
