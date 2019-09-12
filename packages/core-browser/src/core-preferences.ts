import { Injector } from '@ali/common-di';
import { createPreferenceProxy, PreferenceProxy, PreferenceService, PreferenceContribution, PreferenceSchema } from './preferences';

import { isOSX, isLinux, localize } from '@ali/ide-core-common';

const DEFAULT_WINDOWS_FONT_FAMILY = 'Consolas, \'Courier New\', monospace';
const DEFAULT_MAC_FONT_FAMILY = 'Menlo, Monaco, \'Courier New\', monospace';
const DEFAULT_LINUX_FONT_FAMILY = '\'Droid Sans Mono\', \'monospace\', monospace, \'Droid Sans Fallback\'';

export const EDITOR_FONT_DEFAULTS = {
  fontFamily: (
    isOSX ? DEFAULT_MAC_FONT_FAMILY : (isLinux ? DEFAULT_LINUX_FONT_FAMILY : DEFAULT_WINDOWS_FONT_FAMILY)
  ),
  fontWeight: 'normal',
  fontSize: (
    isLinux ? 12 : 14
  ),
  lineHeight: 0,
  letterSpacing: 0,
  confirmDelete: true,
  confirmMove: true,
  filesWatcherExclude: {
    '**/.git/objects/**': true,
    '**/.git/subtree-cache/**': true,
    '**/node_modules/**': true,
  },
};

// TODO: 实现 https://code.visualstudio.com/docs/getstarted/settings
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
    'editor.fontFamily': {
      type: 'string',
      default: EDITOR_FONT_DEFAULTS.fontFamily,
      description: '%editor.configuration.fontFamily%',
    },
    'editor.fontWeight': {
      type: 'string',
      default: EDITOR_FONT_DEFAULTS.fontWeight,
      description: '%editor.configuration.fontWeight%',
    },
    'editor.fontSize': {
      type: 'number',
      default: EDITOR_FONT_DEFAULTS.fontSize,
      description: '%editor.configuration.fontSize%',
    },
    'explorer.confirmMove': {
      type: 'boolean',
      default: EDITOR_FONT_DEFAULTS.confirmDelete,
      description: localize('preference.explorer.comfirm.move'),
    },
    'explorer.confirmDelete': {
      type: 'boolean',
      default: EDITOR_FONT_DEFAULTS.confirmMove,
      description: localize('preference.explorer.comfirm.delete'),
    },
    'files.watcherExclude': {
      type: 'object',
      default:  EDITOR_FONT_DEFAULTS.filesWatcherExclude,
      description: localize('preference.files.watcherExclude'),
    },
  },
};
export interface CoreConfiguration {
  'application.confirmExit': 'never' | 'ifRequired' | 'always';
  'list.openMode': 'singleClick' | 'doubleClick';
  'workbench.commandPalette.history': number;
  'explorer.confirmDelete': boolean;
  'explorer.confirmMove': boolean;
  'files.watcherExclude': any;
}

export const CorePreferences = Symbol('CorePreferences');
export type CorePreferences = PreferenceProxy<CoreConfiguration>;

export function injectCorePreferences(inject: Injector) {
  inject.addProviders({
    token: CorePreferences,
    useFactory: (inject: Injector) => {
      const preferences: PreferenceService = inject.get(PreferenceService);
      return createPreferenceProxy(preferences, corePreferenceSchema);
    },
  });
}
