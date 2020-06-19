import { vscAuthority } from './const';

export const tsLangBasicExtContributes = {
  extPath: vscAuthority + '/typescript-basics',
  pkgJSON: {
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
        // vscode 新版本 ts-basis 插件已经没有了这一行配置
        // {
        //   'scopeName': 'documentation.injection',
        //   'path': './syntaxes/jsdoc.injection.tmLanguage.json',
        //   'injectTo': [
        //     'source.ts',
        //     'source.tsx',
        //     'source.js',
        //     'source.js.jsx',
        //   ],
        // },
      ],
    },
  },
};
