import { Injector } from '@ali/common-di';
import { createPreferenceProxy, PreferenceProxy, PreferenceService, PreferenceContribution, PreferenceSchema } from './preferences';

import { isOSX, isLinux, localize, getAvailableLanguages } from '@ali/ide-core-common';

const DEFAULT_WINDOWS_FONT_FAMILY = 'Consolas, \'Courier New\', monospace';
const DEFAULT_MAC_FONT_FAMILY = 'Menlo, Monaco, \'Courier New\', monospace';
const DEFAULT_LINUX_FONT_FAMILY = '\'Droid Sans Mono\', \'monospace\', monospace, \'Droid Sans Fallback\'';

export const EDITOR_FONT_DEFAULTS = {
  fontFamily: (
    isOSX ? DEFAULT_MAC_FONT_FAMILY : (isLinux ? DEFAULT_LINUX_FONT_FAMILY : DEFAULT_WINDOWS_FONT_FAMILY)
  ),
  fontWeight: 'normal',
  fontSize: 12,
  tabSize: 2,
  renderWhitespace: false,
  cursorStyle: 'line',
  insertSpace: false,
  wordWrap: 'off',
  wordWrapColumn: 80,
  lineHeight: 0,
  letterSpacing: 0,
  confirmDelete: true,
  confirmMove: true,
};

export const FILES_DEFAULTS = {
  filesWatcherExclude: {
    '**/.git/objects/**': true,
    '**/.git/subtree-cache/**': true,
    '**/node_modules/**': true,
  },
  filesExclude: {
    '**/.git': true,
    '**/.svn': true,
    '**/.hg': true,
    '**/CVS': true,
    '**/.DS_Store': true,
  },
};

// TODO: 实现 https://code.visualstudio.com/docs/getstarted/settings
export const corePreferenceSchema: PreferenceSchema = {
  'type': 'object',
  properties: {
    // 'list.openMode': {
    //   type: 'string',
    //   enum: [
    //     'singleClick',
    //     'doubleClick',
    //   ],
    //   default: 'singleClick',
    //   description: 'Controls how to open items in trees using the mouse.',
    // },
    'general.language': {
      type: 'string',
      enum: getAvailableLanguages().map((l) => l.languageId),
      default: 'zh-CN',
      description: '%preference.description.general.language%',
    },
    'general.theme': {
      type: 'string',
      default: 'vs-dark',
      description: '%preference.description.general.language%',
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
    'editor.tabSize': {
      type: 'number',
      default: EDITOR_FONT_DEFAULTS.tabSize,
      description: '%editor.configuration.tabSize%',
    },
    'editor.renderWhitespace': {
      type: 'boolean',
      default: EDITOR_FONT_DEFAULTS.renderWhitespace,
      description: '%editor.configuration.renderWhitespace%',
    },
    'editor.cursorStyle': {
      type: 'string',
      enum: [
        'line',
        'block',
        'block-outline',
        'line-thin',
        'underline',
        'underline-thin',
      ],
      default: EDITOR_FONT_DEFAULTS.cursorStyle,
      description: '%editor.configuration.cursorStyle%',
    },
    'editor.insertSpace': {
      type: 'boolean',
      default: EDITOR_FONT_DEFAULTS.insertSpace,
      description: '%editor.configuration.insertSpace%',
    },
    'editor.wordWrap': {
      type: 'string',
      enum: [
        'off',
        'on',
      ],
      default: EDITOR_FONT_DEFAULTS.wordWrap,
      description: '%editor.configuration.wordWrap%',
    },
    'editor.wordWrapColumn': {
      type: 'number',
      default: EDITOR_FONT_DEFAULTS.wordWrapColumn,
      description: '%editor.configuration.wordWrapColumn%',
    },
    'explorer.confirmMove': {
      type: 'boolean',
      default: EDITOR_FONT_DEFAULTS.confirmDelete,
      description: '%preference.explorer.comfirm.move%',
    },
    'explorer.confirmDelete': {
      type: 'boolean',
      default: EDITOR_FONT_DEFAULTS.confirmMove,
      description: '%preference.explorer.comfirm.delete%',
    },
    'files.exclude': {
      type: 'object',
      description: '%preference.files.exclude%',
      default: FILES_DEFAULTS.filesExclude,
    },
    'files.watcherExclude': {
      type: 'object',
      default:  FILES_DEFAULTS.filesWatcherExclude,
      description: '%preference.files.watcherExclude%',
    },
  },
};

export interface CoreConfiguration {
  'application.confirmExit': 'never' | 'ifRequired' | 'always';
  'list.openMode': 'singleClick' | 'doubleClick';
  'workbench.commandPalette.history': number;
  'explorer.confirmDelete': boolean;
  'explorer.confirmMove': boolean;
  'files.watcherExclude': { [key: string]: boolean };
  'files.exclude': { [key: string]: boolean };
  'general.language': string;
  'general.theme': string;
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
