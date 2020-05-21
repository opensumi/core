import { Injector } from '@ali/common-di';
import { createPreferenceProxy, PreferenceProxy, PreferenceService, PreferenceSchema } from './preferences';

import { localize, getAvailableLanguages, isElectronRenderer, isWindows } from '@ali/ide-core-common';

const EXPLORER_DEFAULTS = {
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

export const FILE_TREE_DEFAULTS = {
  baseIndent: 10,
  indent: 8,
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
    'workbench.colorCustomizations': {
      type: 'object',
      description: '%preference.workbench.colorCustomizations%',
      default: {},
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
    'application.invalidExthostReload': {
      type: 'string',
      enum: [
        'ifRequired',
        'always',
      ],
      default: 'ifRequired',
      description: 'Reload strategy when exthost process became invalid.',
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

    'explorer.confirmMove': {
      type: 'boolean',
      default: EXPLORER_DEFAULTS.confirmDelete,
      description: '%preference.explorer.confirm.move%',
    },
    'explorer.confirmDelete': {
      type: 'boolean',
      default: EXPLORER_DEFAULTS.confirmMove,
      description: '%preference.explorer.confirm.delete%',
    },
    'explorer.fileTree.baseIndent': {
      type: 'number',
      default: FILE_TREE_DEFAULTS.baseIndent,
      description: '%preference.explorer.fileTree.baseIndent%',
    },
    'explorer.fileTree.indent': {
      type: 'number',
      default: FILE_TREE_DEFAULTS.indent,
      description: '%preference.explorer.fileTree.indent%',
    },
    'explorer.compactFolders': {
      type: 'boolean',
      description: '%preference.explorer.compactFolders%',
      default: true,
    },
    'debug.toolbar.float': {
      type: 'boolean',
      default: true,
      description: '%preference.debug.toolbar.float%',
    },
    'debug.toolbar.top': {
      type: 'number',
      default: 0,
      description: '%preference.debug.toolbar.top%',
    },
    'debug.toolbar.height': {
      type: 'number',
      default: 30,
      description: '%preference.debug.toolbar.height%',
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
    // 终端
    'terminal.type': {
      type: 'string',
      // FIXME: 此处应该是node层的platform，考虑到目前只有electron会有windows机器，暂时这样
      enum: (isElectronRenderer() && isWindows) ? [
        'powershell',
        'cmd',
        'default',
      ] : [
        'bash',
        'zsh',
        'sh',
        'default',
      ],
      default: '',
      description: '%preference.terminal.typeDesc%',
    },
    'terminal.fontFamily': {
      type: 'string',
      description: '%preference.terminal.fontFamilyDesc%',
    },
    'terminal.fontSize': {
      type: 'number',
      default: 12,
      description: '%preference.terminal.fontSizeDesc%',
    },
    'terminal.fontWeight': {
      type: 'string',
      enum: [
        'normal',
        'bold',
      ],
      default: 400,
      description: '%preference.terminal.fontWeightDesc%',
    },
    'terminal.lineHeight': {
      type: 'number',
      default: 1,
      description: '%preference.terminal.lineHeightDesc%',
    },
    'terminal.cursorBlink': {
      type: 'boolean',
      default: false,
      description: '%preference.terminal.cursorBlinkDesc%',
    },
    'terminal.scrollback': {
      type: 'number',
      default: 5000,
      description: '%preference.terminal.scrollbackDesc%',
    },
  },
};

export interface CoreConfiguration {
  'application.confirmExit': 'never' | 'ifRequired' | 'always';
  'application.invalidExthostReload': 'ifRequired' | 'always';
  'workbench.list.openMode': 'singleClick' | 'doubleClick';
  'workbench.commandPalette.history': number;
  'explorer.confirmDelete': boolean;
  'explorer.fileTree.baseIndent': number;
  'explorer.fileTree.indent': number;
  'explorer.confirmMove': boolean;
  'explorer.compactFolders': boolean;
  'debug.toolbar.float': boolean;
  'debug.toolbar.top': number;
  'debug.toolbar.height': number;
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
