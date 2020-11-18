import { IExtensionMetaData } from '@ali/ide-kaitian-extension/lib/common';

const vscAuthority = 'kt-ext://cdn.jsdelivr.net/gh/microsoft/vscode/extensions';

export const nodeLessExtensions: IExtensionMetaData[] = [
  {
    id: 'themeDefaults',
    extensionId: 'tao.themeDefaults',
    path: vscAuthority + '/theme-defaults',
    extraMetadata: {},
    isBuiltin: false,
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
    isBuiltin: false,
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
    isBuiltin: false,
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
    isBuiltin: false,
    'path': 'kt-ext://dev.g.alicdn.com/tao-ide/ide-lite/0.0.1/extensions/completion',
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
    'realPath': 'https://dev.g.alicdn.com/tao-ide/ide-lite/0.0.1/extensions/completion',
    defaultPkgNlsJSON: undefined,
    packageNlsJSON: undefined,
    extraMetadata: {},
    extendConfig: {},
  },
];
