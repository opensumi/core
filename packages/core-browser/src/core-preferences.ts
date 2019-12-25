import { Injector } from '@ali/common-di';
import { createPreferenceProxy, PreferenceProxy, PreferenceService, PreferenceSchema } from './preferences';

import { isOSX, isLinux, localize, getAvailableLanguages, isElectronRenderer } from '@ali/ide-core-common';

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
    'general.language': {
      type: 'string',
      enum: getAvailableLanguages().map((l) => l.languageId),
      default: 'zh-CN',
      description: '%preference.description.general.language%',
    },
    'general.theme': {
      type: 'string',
      default: 'vs-dark',
      description: '%preference.description.general.theme%',
    },
    'general.askReloadOnLanguageChange': {
      type: 'boolean',
      default: true,
      description: '%preference.description.general.askReloadOnLanguageChange%',
    },
    'general.icon': {
      type: 'string',
      default: 'vs-minimal',
      description: '%preference.description.general.icon%',
    },
    // 是否允许打开文件夹
    'application.supportsOpenFolder': {
      type: 'boolean',
      default: isElectronRenderer(),
      description: 'Whether default open folder behavior is supported',
    },
    'application.confirmExit': {
      type: 'string',
      enum: [
        'never',
        'ifRequired',
        'always',
      ],
      default: 'always',
      description: 'When to confirm before closing the application window.',
    },
    'application.preferMarkdownPreview': {
      type: 'boolean',
      default: false,
      description: 'Use markdown preview first',
    },
    'workbench.list.openMode': {
      type: 'string',
      enum: ['singleClick', 'doubleClick'],
      default: 'singleClick',
      description: localize('preference.workbench.list.openMode'),
    },
    'workbench.commandPalette.history': {
      type: 'number',
      default: 50,
      minimum: 0,
      description: 'Controls the number of recently used commands to keep in history for the command palette. Set to 0 to disable command history.',
    },
    'editor.askIfDiff': {
      type: 'boolean',
      default: true,
      description: '%editor.configuration.askIfDiff%',
    },
    'editor.showActionWhenGroupEmpty': {
      type: 'boolean',
      default: false,
      description: '%editor.configuration.showActionWhenGroupEmpty%',
    },
    'editor.autoSave': {
      type: 'string',
      enum: [
        'off',
        'afterDelay',
        'editorFocusChange',
        'windowLostFocus',
      ],
      default: 'off',
      description: '%editor.configuration.autoSave%',
    },
    'editor.autoSaveDelay': {
      type: 'number',
      default: 1000,
      description: '%editor.configuration.autoSaveDelay%',
    },
    'editor.preferredFormatter': {
      type: 'object',
      default: {},
      description: '%editor.configuration.preferredFormatter%',
    },
    'editor.previewMode': {
      type: 'boolean',
      default: true,
      description: '%editor.configuration.preview%',
    },
    'editor.minimap': {
      type: 'boolean',
      default: false,
      description: '%editor.configuration.minimap%',
    },
    // 会启用languageFeature的最大文件尺寸
    'editor.languageFeatureEnabledMaxSize': {
      type: 'number',
      default: 2 * 1024 * 1024, // 2M
      description: '%editor.configuration.languageFeatureEnabledMaxSize%',
    },
    // 会同步到extHost的最大文件尺寸, 必须大于等于 languageFeatureEnabledMaxSize
    'editor.docExtHostSyncMaxSize': {
      type: 'number',
      default: 2 * 1024 * 1024, // 2M
      description: '%editor.configuration.docExtHostSyncMaxSize%',
    },
    'editor.renderLineHighlight': {
      type: 'string',
      enum: [
        'none',
        'gutter',
        'line',
        'all',
      ],
      default: 'all',
      description: '%editor.configuration.renderLineHighlight%',
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
    'editor.readonlyFiles': {
      type: 'array',
      default: [],
      description: '%editor.configuration.readonlyFiles%',
    },
    'editor.formatOnSave': {
      type: 'boolean',
      default: false,
      description: '%preference.editor.formatOnSave%',
    },
    'editor.formatOnSaveTimeout': {
      type: 'number',
      default: 750,
      description: '%editor.configuration.readonlyFiles%',
    },
    'editor.maxTokenizationLineLength': {
      type: 'integer',
      default: 10000,
      description: '%editor.configuration.maxTokenizationLineLength%',
    },
    'explorer.confirmMove': {
      type: 'boolean',
      default: EDITOR_FONT_DEFAULTS.confirmDelete,
      description: '%preference.explorer.confirm.move%',
    },
    'explorer.confirmDelete': {
      type: 'boolean',
      default: EDITOR_FONT_DEFAULTS.confirmMove,
      description: '%preference.explorer.confirm.delete%',
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
    'files.associations': {
      type: 'object',
      description: '%preference.files.associations%',
    },
    // 设置面板是否用户Scope在前
    'settings.userBeforeWorkspace': {
      type: 'boolean',
      default: false,
      description: '%settings.configuration.userBeforeWorkspace%',
    },
  },
};

export interface CoreConfiguration {
  'application.confirmExit': 'never' | 'ifRequired' | 'always';
  'workbench.list.openMode': 'singleClick' | 'doubleClick';
  'workbench.commandPalette.history': number;
  'explorer.confirmDelete': boolean;
  'explorer.confirmMove': boolean;
  'files.watcherExclude': { [key: string]: boolean };
  'files.exclude': { [key: string]: boolean };
  'files.associations': { [key: string]: string };
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
