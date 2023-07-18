import { Injector } from '@opensumi/di';
import {
  localize,
  getAvailableLanguages,
  SUPPORTED_ENCODINGS,
  GeneralSettingsId,
  PreferenceSchema,
  MenubarSettingId,
} from '@opensumi/ide-core-common';
import { LOCALE_TYPES } from '@opensumi/ide-core-common/lib/const';

import { createPreferenceProxy, PreferenceProxy, PreferenceService } from './preferences';

const EXPLORER_DEFAULTS = {
  confirmDelete: true,
  confirmMove: true,
};

export const FILES_DEFAULTS = {
  filesWatcherExclude: {
    '**/.git/objects/**': true,
    '**/.git/subtree-cache/**': true,
    '**/node_modules/**/*': true,
    '**/.hg/store/**': true,
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

export const corePreferenceSchema: PreferenceSchema = {
  type: 'object',
  properties: {
    'general.language': {
      type: 'string',
      enum: getAvailableLanguages().map((l) => l.languageId),
      default: LOCALE_TYPES.EN_US,
    },
    'general.theme': {
      type: 'string',
      default: 'vs-dark',
      enum: [],
    },
    'general.askReloadOnLanguageChange': {
      type: 'boolean',
      default: true,
      description: '%preference.description.general.askReloadOnLanguageChange%',
    },
    [GeneralSettingsId.Icon]: {
      type: 'string',
      default: 'vs-minimal',
      enum: [],
    },
    'workbench.colorCustomizations': {
      type: 'object',
      description: '%preference.workbench.colorCustomizations%',
      default: {},
    },

    // 是否允许打开文件夹
    'application.supportsOpenFolder': {
      type: 'boolean',
      default: false,
      description: 'Whether default open folder behavior is supported',
    },
    'application.supportsOpenWorkspace': {
      type: 'boolean',
      default: false,
      description: 'Whether default open workspace behavior is supported',
    },
    'application.confirmExit': {
      type: 'string',
      enum: ['never', 'ifRequired', 'always'],
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
      enum: ['ifRequired', 'always'],
      default: 'ifRequired',
      description: 'Reload strategy when exthost process became invalid.',
    },
    'workbench.list.openMode': {
      type: 'string',
      enum: ['singleClick', 'doubleClick'],
      default: 'singleClick',
      description: '%preference.workbench.list.openMode%',
    },
    'workbench.commandPalette.history': {
      type: 'number',
      default: 50,
      minimum: 0,
      description:
        'Controls the number of recently used commands to keep in history for the command palette. Set to 0 to disable command history.',
    },
    'workbench.refactoringChanges.showPreviewStrategy': {
      type: 'string',
      default: 'askMe',
      enum: ['show', 'hide', 'askMe'],
      description: '%preference.workbench.refactoringChanges.showPreviewStrategy%',
    },
    'workbench.quickOpen.preserveInput': {
      type: 'boolean',
      default: true,
      description: '%workbench.quickOpen.preserveInput%',
    },
    'workbench.hideSlotTabBarWhenHidePanel': {
      type: 'boolean',
      default: false,
      description: '%workbench.hideSlotTabBarWhenHidePanel%',
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
    },
    'explorer.fileTree.indent': {
      type: 'number',
      default: FILE_TREE_DEFAULTS.indent,
    },
    'explorer.compactFolders': {
      type: 'boolean',
      description: '%preference.explorer.compactFolders%',
      default: true,
    },
    'explorer.autoReveal': {
      type: 'boolean',
      default: true,
    },
    'debug.toolbar.float': {
      type: 'boolean',
      default: true,
    },
    'debug.breakpoint.editorHint': {
      type: 'boolean',
      default: true,
      description: '%preference.debug.breakpoint.editorHint%',
    },
    'debug.breakpoint.showBreakpointsInOverviewRuler': {
      type: 'boolean',
      default: false,
      description: '%preference.debug.breakpoint.showBreakpointsInOverviewRuler%',
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
    'debug.console.filter.mode': {
      type: 'string',
      enum: ['filter', 'matcher'],
      default: 'filter',
    },
    'files.exclude': {
      type: 'object',
      description: '%preference.files.exclude%',
      default: FILES_DEFAULTS.filesExclude,
      additionalProperties: {
        anyOf: [
          {
            type: 'boolean',
            description: localize(
              'files.exclude.boolean',
              'The glob pattern to match file paths against. Set to true or false to enable or disable the pattern.',
            ),
          },
        ],
      },
    },
    'files.watcherExclude': {
      type: 'object',
      default: FILES_DEFAULTS.filesWatcherExclude,
      description: '%preference.files.watcherExclude%',
    },
    'files.associations': {
      type: 'object',
      markdownDescription: '%preference.files.associations%',
    },
    'files.encoding': {
      type: 'string',
      description: '%preference.files.encoding%',
      default: 'utf8',
      enum: Object.keys(SUPPORTED_ENCODINGS),
    },
    'files.eol': {
      type: 'string',
      enum: ['\n', '\r\n', 'auto'],
      default: 'auto',
    },
    'files.trimFinalNewlines': {
      type: 'boolean',
      default: false,
    },
    'files.trimTrailingWhitespace': {
      type: 'boolean',
      default: false,
    },
    'files.insertFinalNewline': {
      type: 'boolean',
      default: false,
    },
    'files.autoGuessEncoding': {
      type: 'boolean',
      default: false,
      description: '%preference.files.autoGuessEncoding%',
      included: Object.keys(SUPPORTED_ENCODINGS).length > 1,
    },
    // 设置面板是否用户Scope在前
    'settings.userBeforeWorkspace': {
      type: 'boolean',
      default: false,
      description: '%settings.configuration.userBeforeWorkspace%',
    },
    'output.maxChannelLine': {
      type: 'number',
      default: 50000,
      description: '%output.maxChannelLineDesc%',
    },
    'output.enableLogHighlight': {
      type: 'boolean',
      default: true,
      description: '%output.enableLogHighlightDesc%',
    },
    'output.enableSmartScroll': {
      type: 'boolean',
      default: true,
      description: '%output.enableSmartScrollDesc%',
    },
    'debug.inline.values': {
      type: 'boolean',
      default: false,
    },
    'debug.console.wordWrap': {
      type: 'boolean',
      default: true,
    },
    'toolbar.ignoreActions': {
      type: 'object',
      patternProperties: {
        '.*': {
          type: 'array',
          items: [{ type: 'string' }],
        },
      },
      description: '%preference.toolbar.ignoreActions%',
    },
    'toolbar.buttonDisplay': {
      type: 'string',
      enum: ['icon', 'iconAndText'],
      default: 'iconAndText',
      description: '%preference.toolbar.buttonDisplay%',
    },
    'toolbar.buttonTitleStyle': {
      type: 'string',
      enum: ['vertical', 'horizontal'],
      default: 'horizontal',
    },
    'view.saveLayoutWithWorkspace': {
      type: 'boolean',
      default: false,
    },
    [MenubarSettingId.CompactMode]: {
      type: 'boolean',
      default: false,
    },
  },
};

export interface CoreConfiguration {
  'application.confirmExit': 'never' | 'ifRequired' | 'always';
  'application.invalidExthostReload': 'ifRequired' | 'always';
  'workbench.list.openMode': 'singleClick' | 'doubleClick';
  'debug.console.filter.mode': 'filter' | 'matcher';
  'workbench.commandPalette.history': number;
  'workbench.refactoringChanges.showPreviewStrategy': string;
  'workbench.quickOpen.preserveInput': boolean;
  'explorer.confirmDelete': boolean;
  'explorer.fileTree.baseIndent': number;
  'explorer.fileTree.indent': number;
  'explorer.autoReveal': boolean;
  'explorer.confirmMove': boolean;
  'explorer.compactFolders': boolean;
  'debug.toolbar.float': boolean;
  'debug.breakpoint.editorHint': boolean;
  'debug.breakpoint.showBreakpointsInOverviewRuler': boolean;
  'debug.toolbar.top': number;
  'debug.toolbar.height': number;
  'files.watcherExclude': { [key: string]: boolean };
  'files.exclude': { [key: string]: boolean };
  'files.associations': { [key: string]: string };
  'files.encoding': string;
  'general.language': string;
  'general.theme': string;
  'view.saveLayoutWithWorkspace': boolean;
  'menubar.compactMode': boolean;
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
