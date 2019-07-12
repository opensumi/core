import { Injector } from '@ali/common-di';
import { createPreferenceProxy, PreferenceProxy, PreferenceService, PreferenceContribution, PreferenceSchema } from './preferences';

export const corePreferenceSchema: PreferenceSchema = {
  'type': 'object',
  properties: {
    'list.openMode': {
      type: 'string',
      enum: [
        'singleClick',
        'doubleClick',
      ],
      default: 'singleClick',
      description: 'Controls how to open items in trees using the mouse.',
    },
    'application.confirmExit': {
      type: 'string',
      enum: [
        'never',
        'ifRequired',
        'always',
      ],
      default: 'ifRequired',
      description: 'When to confirm before closing the application window.',
    },
    'workbench.commandPalette.history': {
      type: 'number',
      default: 50,
      minimum: 0,
      description: 'Controls the number of recently used commands to keep in history for the command palette. Set to 0 to disable command history.',
    },
  },
};
export interface CoreConfiguration {
  'application.confirmExit': 'never' | 'ifRequired' | 'always';
  'list.openMode': 'singleClick' | 'doubleClick';
  'workbench.commandPalette.history': number;
}

export const CorePreferences = Symbol('CorePreferences');
export type CorePreferences = PreferenceProxy<CoreConfiguration>;

export function createCorePreferencesProvider(inject: Injector) {
  return {
    token: CorePreferences,
    useFactory: () => {
      const preferences: PreferenceService = inject.get(PreferenceService);
      return createPreferenceProxy(preferences, corePreferenceSchema);
    },
  };
}

export function injectCorePreferences(inject: Injector) {
  inject.addProviders(createCorePreferencesProvider(inject));
}
