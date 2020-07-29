import { IExtensionMetaData } from '@ali/ide-kaitian-extension';

const vscAuthority = 'kt-ext://cdn.jsdelivr.net/gh/microsoft/vscode/extensions';

export const nodeLessExtensions: IExtensionMetaData[] = [
  {
    id: 'themeDefaults',
    extensionId: 'tao.themeDefaults',
    path: vscAuthority + '/theme-defaults',
    extraMetadata: {},
    realPath: vscAuthority + '/theme-defaults',
    extendConfig: {},
    defaultPkgNlsJSON: undefined,
    packageNlsJSON: undefined,
    packageJSON: {
      'contributes': {
        'themes': [
          {
            'id': 'Default Dark+',
            'label': 'Dark+ (default dark)',
            'uiTheme': 'vs-dark',
            'path': './themes/dark_plus.json',
          },
          {
            'id': 'Default Light+',
            'label': 'Light+ (default light)',
            'uiTheme': 'vs',
            'path': './themes/light_plus.json',
          },
        ],
        'iconThemes': [
          {
            'id': 'vs-minimal',
            'label': 'Minimal (Visual Studio Code)',
            'path': './fileicons/vs_minimal-icon-theme.json',
          },
        ],
      },
    },
  },
  {
    id: 'seti-icon',
    extensionId: 'tao.seti-icon',
    path: vscAuthority + '/theme-seti',
    extraMetadata: {},
    realPath: vscAuthority + '/theme-seti',
    extendConfig: {},
    defaultPkgNlsJSON: undefined,
    packageNlsJSON: undefined,
    packageJSON: {
      'contributes': {
        'iconThemes': [
          {
            'id': 'vs-seti',
            'label': 'Seti (Visual Studio Code)',
            'path': './icons/vs-seti-icon-theme.json',
          },
        ],
      },
    },
  },
  {
    id: 'typescript-basic',
    extensionId: 'tao.typescript-basic',
    path: vscAuthority + '/typescript-basics',
    extraMetadata: {},
    realPath: vscAuthority + '/typescript-basics',
    extendConfig: {},
    defaultPkgNlsJSON: undefined,
    packageNlsJSON: undefined,
    packageJSON: {
      contributes: {
        'languages': [
          {
            'id': 'typescript',
            'aliases': [
              'TypeScript',
              'ts',
              'typescript',
            ],
            'extensions': [
              '.ts',
            ],
            'configuration': './language-configuration.json',
          },
          {
            'id': 'typescriptreact',
            'aliases': [
              'TypeScript React',
              'tsx',
            ],
            'extensions': [
              '.tsx',
            ],
            'configuration': './language-configuration.json',
          },
          {
            'id': 'jsonc',
            'filenames': [
              'tsconfig.json',
              'jsconfig.json',
            ],
            'filenamePatterns': [
              'tsconfig.*.json',
              'tsconfig-*.json',
            ],
          },
        ],
        'grammars': [
          {
            'language': 'typescript',
            'scopeName': 'source.ts',
            'path': './syntaxes/TypeScript.tmLanguage.json',
            'tokenTypes': {
              'entity.name.type.instance.jsdoc': 'other',
              'entity.name.function.tagged-template': 'other',
              'meta.import string.quoted': 'other',
              'variable.other.jsdoc': 'other',
            },
          },
          {
            'language': 'typescriptreact',
            'scopeName': 'source.tsx',
            'path': './syntaxes/TypeScriptReact.tmLanguage.json',
            'embeddedLanguages': {
              'meta.tag.tsx': 'jsx-tags',
              'meta.tag.without-attributes.tsx': 'jsx-tags',
              'meta.tag.attributes.tsx': 'typescriptreact',
              'meta.embedded.expression.tsx': 'typescriptreact',
            },
            'tokenTypes': {
              'entity.name.type.instance.jsdoc': 'other',
              'entity.name.function.tagged-template': 'other',
              'meta.import string.quoted': 'other',
              'variable.other.jsdoc': 'other',
            },
          },
        ],
      },
    },
  },
  {
    'id': 'kaitian-worker.volans-completions',
    'extensionId': 'extension',
    'path': 'kt-ext://dev.g.alicdn.com/tao-ide/ide-lite/0.0.1',
    'packageJSON': {
      'activationEvents': [
        '*',
      ],
      'kaitianContributes': {
        'workerMain': './dist/extension.js',
      },
      'contributes': {
        'commands': [
          {
            'command': 'volansComplete.refreshConfig',
            'title': '%extension.commands.refresh%',
          },
        ],
        'configuration': {
          'type': 'object',
          'title': 'Mini Program',
          'properties': {
            'Mini-Program.enabledJSAPIComplete': {
              'type': 'boolean',
              'default': true,
              'description': '%extension.configuration.enableJSComplete%',
            },
          },
        },
        'workerMain': './dist/extension.js',
      },
    },
    // 会作为extensionPath，需要带kt-ext scheme，插件代码里需要直接parse uri而不是直接URI.file
    'realPath': 'kt-ext://dev.g.alicdn.com/tao-ide/ide-lite/0.0.1',
    defaultPkgNlsJSON: undefined,
    packageNlsJSON: undefined,
    extraMetadata: {},
    extendConfig: {},
  },
  {
    'id': 'h2.pure-simulator',
    'extensionId': 'h2.pure-simulator',
    'path': 'kt-ext://127.0.0.1:8081',
    'packageJSON': {
      'name': 'Simulator',
      'activationEvents': [
        '*',
      ],
      'contributes': {
        'browserMain': './out/browser/index.js',
        'viewsProxies': [
          'Simulator',
        ],
        'browserViews': {
          'right': {
            'type': 'add',
            'view': [
              {
                'id': 'Simulator',
                'icon': 'extension',
                'title': 'Simulator',
              },
            ],
          },
        },
      },
      'kaitianContributes': {
        'browserMain': './out/browser/index.js',
        'viewsProxies': [
          'Simulator',
        ],
        'browserViews': {
          'right': {
            'type': 'add',
            'view': [
              {
                'id': 'Simulator',
                'icon': 'extension',
                'title': 'Simulator',
              },
            ],
          },
        },
      },
    },
    // 会作为extensionPath，需要带kt-ext scheme，插件代码里需要直接parse uri而不是直接URI.file
    'realPath': 'kt-ext://127.0.0.1:8081',
    defaultPkgNlsJSON: undefined,
    packageNlsJSON: undefined,
    extraMetadata: {},
    extendConfig: {},
  },
  {
    'id': 'kaitian.comments',
    'extensionId': 'kaitian.comments',
    'path': 'kt-ext://127.0.0.1:8082',
    'packageJSON': {
      'activationEvents': [
        '*',
      ],
      'contributes': {
        'commands': [
          {
            'command': 'mywiki.createNote',
            'title': 'Create Note',
            'enablement': '!commentIsEmpty',
          },
          {
            'command': 'mywiki.replyNote',
            'title': 'Reply',
            'enablement': '!commentIsEmpty',
          },
          {
            'command': 'mywiki.editNote',
            'title': 'Edit',
            'icon': {
              'dark': 'resources/edit_inverse.svg',
              'light': 'resources/edit.svg',
            },
          },
          {
            'command': 'mywiki.deleteNote',
            'title': 'Delete',
            'icon': {
              'dark': 'resources/close_inverse.svg',
              'light': 'resources/close.svg',
            },
          },
          {
            'command': 'mywiki.deleteNoteComment',
            'title': 'Delete',
            'icon': {
              'dark': 'resources/close_inverse.svg',
              'light': 'resources/close.svg',
            },
          },
          {
            'command': 'mywiki.saveNote',
            'title': 'Save',
          },
          {
            'command': 'mywiki.cancelsaveNote',
            'title': 'Cancel',
          },
          {
            'command': 'mywiki.startDraft',
            'title': 'Start draft',
            'enablement': '!commentIsEmpty',
          },
          {
            'command': 'mywiki.finishDraft',
            'title': 'Finish draft',
          },
          {
            'command': 'mywiki.dispose',
            'title': 'Remove All Notes',
          },
        ],
        'menus': {
          'commandPalette': [
            {
              'command': 'mywiki.createNote',
              'when': 'false',
            },
            {
              'command': 'mywiki.replyNote',
              'when': 'false',
            },
            {
              'command': 'mywiki.deleteNote',
              'when': 'false',
            },
            {
              'command': 'mywiki.deleteNoteComment',
              'when': 'false',
            },
          ],
          'comments/commentThread/title': [
            {
              'command': 'mywiki.deleteNote',
              'group': 'navigation',
              'when': '!commentThreadIsEmpty',
            },
          ],
          'comments/commentThread/context': [
            {
              'command': 'mywiki.createNote',
              'group': 'inline',
              'when': 'commentThreadIsEmpty',
            },
            {
              'command': 'mywiki.replyNote',
              'group': 'inline',
              'when': '!commentThreadIsEmpty',
            },
            {
              'command': 'mywiki.startDraft',
              'group': 'inline',
              'when': 'commentThread != draft',
            },
            {
              'command': 'mywiki.finishDraft',
              'group': 'inline',
              'when': 'commentThread == draft',
            },
          ],
          'comments/comment/title': [
            {
              'command': 'mywiki.editNote',
              'group': 'group@1',
            },
            {
              'command': 'mywiki.deleteNoteComment',
              'group': 'group@2',
            },
          ],
          'comments/comment/context': [
            {
              'command': 'mywiki.cancelsaveNote',
              'group': 'inline@1',
            },
            {
              'command': 'mywiki.saveNote',
              'group': 'inline@2',
            },
          ],
        },
        'browserMain': './out/browser/index.js',
        'workerMain': './out/worker/index.js',
        'viewsProxies': [
          'Leftview',
        ],
        'browserViews': {
          'right': {
            'type': 'add',
            'view': [
              {
                'id': 'Leftview',
                'icon': 'extension',
                'title': 'MR',
              },
            ],
          },
        },
      },
      'kaitianContributes': {
        'browserMain': './out/browser/index.js',
        'viewsProxies': [
          'Leftview',
        ],
        'browserViews': {
          'right': {
            'type': 'add',
            'view': [
              {
                'id': 'Leftview',
                'icon': 'extension',
                'title': 'MR',
              },
            ],
          },
        },
        'workerMain': './out/worker/index.js',
      },
    },
    // 会作为extensionPath，需要带kt-ext scheme，插件代码里需要直接parse uri而不是直接URI.file
    'realPath': 'kt-ext://127.0.0.1:8082',
    defaultPkgNlsJSON: undefined,
    packageNlsJSON: undefined,
    extraMetadata: {},
    extendConfig: {},
  },
];
