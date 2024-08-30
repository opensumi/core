const path = require('path');

const rulesDirPlugin = require('eslint-plugin-rulesdir');
rulesDirPlugin.RULES_DIR = path.join(__dirname, 'scripts', 'eslint-rules', 'rules');

module.exports = {
  env: {
    browser: true,
    es6: true,
    node: true,
    'jest/globals': true,
  },
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'rulesdir', 'import', 'unused-imports'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    // 后续可开启eslint-plugin-import的推荐规则
    'plugin:eslint-plugin-import/recommended',
    'plugin:eslint-plugin-import/typescript',
    'prettier',
  ],
  settings: {
    'import/resolver': {
      typescript: {
        project: './tsconfig.json',
      },
    },
    'import/internal-regex': '^@opensumi/',
  },
  rules: {
    '@typescript-eslint/adjacent-overload-signatures': 'error',
    '@typescript-eslint/array-type': 'off',
    '@typescript-eslint/consistent-type-assertions': 'error',
    '@typescript-eslint/consistent-type-definitions': 'error',
    '@typescript-eslint/dot-notation': 'off',
    '@typescript-eslint/explicit-member-accessibility': [
      'off',
      {
        accessibility: 'explicit',
      },
    ],
    '@typescript-eslint/member-delimiter-style': [
      'error',
      {
        multiline: {
          delimiter: 'semi',
          requireLast: true,
        },
        singleline: {
          delimiter: 'semi',
          requireLast: false,
        },
      },
    ],
    '@typescript-eslint/member-ordering': 'off',
    '@typescript-eslint/naming-convention': 'off',
    '@typescript-eslint/no-empty-function': 'off',
    '@typescript-eslint/no-empty-interface': 'error',
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-misused-new': 'error',
    '@typescript-eslint/no-namespace': 'off',
    '@typescript-eslint/no-parameter-properties': 'off',
    '@typescript-eslint/no-shadow': [
      'off',
      {
        hoist: 'all',
      },
    ],
    '@typescript-eslint/no-unused-expressions': 'off',
    '@typescript-eslint/no-use-before-define': 'off',
    '@typescript-eslint/no-var-requires': 'off',
    '@typescript-eslint/prefer-for-of': 'error',
    '@typescript-eslint/prefer-function-type': 'error',
    '@typescript-eslint/prefer-namespace-keyword': 'error',
    '@typescript-eslint/quotes': [
      'error',
      'single',
      {
        avoidEscape: true,
      },
    ],
    '@typescript-eslint/semi': ['error', 'always'],
    '@typescript-eslint/triple-slash-reference': [
      'error',
      {
        path: 'always',
        types: 'prefer-import',
        lib: 'always',
      },
    ],
    '@typescript-eslint/type-annotation-spacing': 'error',
    '@typescript-eslint/unified-signatures': 'error',
    'arrow-body-style': 'error',
    'arrow-parens': ['error', 'always'],
    'comma-dangle': ['error', 'always-multiline'],
    complexity: 'off',
    'constructor-super': 'error',
    curly: 'error',
    'eol-last': 'error',
    eqeqeq: ['error', 'smart'],
    'guard-for-in': 'error',
    'id-match': 'error',
    'max-classes-per-file': 'off',
    'max-len': 'off',
    'new-parens': 'error',
    'no-bitwise': 'off',
    'no-caller': 'error',
    'no-cond-assign': 'off',
    'no-console': 'error',
    'no-debugger': 'error',
    'no-constant-condition': ['error', { checkLoops: false }],
    // We strongly recommend that you do not use the no-undef lint rule on TypeScript projects.
    // The checks it provides are already provided by TypeScript without the need for configuration
    // TypeScript just does this significantly better.
    'no-undef': 'off',
    'no-empty': 'off',
    'no-eval': 'off',
    'no-fallthrough': 'off',
    'no-invalid-this': 'off',
    'no-multiple-empty-lines': 'error',
    'no-new-wrappers': 'error',
    'no-throw-literal': 'error',
    'no-trailing-spaces': 'error',
    'no-undef-init': 'error',
    'no-unsafe-finally': 'error',
    'no-unused-labels': 'error',
    'object-shorthand': 'error',
    'one-var': ['error', 'never'],
    'prefer-arrow/prefer-arrow-functions': 'off',
    'quote-props': 'off',
    radix: 'error',
    'spaced-comment': [
      'error',
      'always',
      {
        markers: ['/'],
      },
    ],
    'use-isnan': 'error',
    'valid-typeof': 'off',
    'no-irregular-whitespace': ['error', { skipComments: true }],
    'no-inner-declarations': 'off',
    'no-useless-catch': 'warn',
    // TODO: should set below to error in future
    'no-useless-escape': 'warn',
    'no-async-promise-executor': 'warn',
    'prefer-const': 'warn',
    '@typescript-eslint/no-non-null-asserted-optional-chain': 'warn',
    '@typescript-eslint/ban-ts-comment': 'warn',
    '@typescript-eslint/no-this-alias': 'warn',
    '@typescript-eslint/ban-types': 'warn',
    'no-prototype-builtins': 'warn',
    'prefer-rest-params': 'warn',
    'no-control-regex': 'warn',
    '@typescript-eslint/no-non-null-assertion': 'off',
    'unused-imports/no-unused-imports': 'warn',
    'import/no-named-as-default-member': 'off',
    'import/no-unresolved': 'off',
    'import/export': 'off',
    'import/namespace': 'off',
    'import/default': 'off',
    'import/named': 'off',
    'sort-imports': [
      'error',
      {
        ignoreDeclarationSort: true,
      },
    ],
    // 让 import 中的内部包和外部包分组，看起来更美观
    'import/order': [
      'error',
      {
        groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index', 'object', 'type', 'unknown'],
        alphabetize: {
          order: 'asc',
          caseInsensitive: true,
        },
        'newlines-between': 'always',
      },
    ],
    'import/no-relative-packages': 'warn',
    'import/no-restricted-paths': [
      'error',
      {
        zones: [
          {
            target: './packages/**/*/!(__tests__)/browser/**/*',
            from: './packages/**/*/node/**/*',
            message: '`browser` should not import the `node` modules',
          },
          {
            target: './packages/**/*/!(__tests__)/node/**/*',
            from: './packages/**/*/browser/**/*',
            message: '`node` should not import the `browser` modules',
          },
          {
            target: './packages/**/*/!(__tests__)/common/**/*',
            from: './packages/**/*/node/**/*',
            message: '`common` should not import the `node` modules',
          },
          {
            target: './packages/**/*/!(__tests__)/common/**/*',
            from: './packages/**/*/browser/**/*',
            message: '`common` should not import the `browser` modules',
          },
        ],
      },
    ],
    'rulesdir/classnames-import-rule': ['error'],
    'no-restricted-imports': [
      'error',
      {
        paths: [
          {
            name: '@opensumi/monaco-editor-core/esm/vs/editor/editor.api',
            message: 'please re-export the reference you want from `monaco-editor` in the `ide-monaco` package.',
          },
        ],
        patterns: [
          {
            group: ['@opensumi/*/src/**/*', '!@opensumi/ide-dev-tool/src/**/*'],
            message: "please import from 'esm' or 'lib' instead of 'src'.",
          },
        ],
      },
    ],
    '@typescript-eslint/no-unused-vars': ['warn'],
  },
  overrides: [
    {
      files: ['**/*.test.ts', '**/*.test.tsx'],
      rules: {
        'no-restricted-imports': 0,
      },
    },
    {
      files: ['scripts/**'],
      rules: {
        'no-restricted-imports': 0,
        'no-console': 0,
        'import/no-relative-packages': 0,
      },
    },
    {
      files: ['__tests__/**', 'tests/**'],
      plugins: ['jest'],
      extends: ['plugin:jest/recommended'],
      rules: { 'jest/prefer-expect-assertions': 'warn', 'jest/no-done-callback': 'warn' },
    },
  ],
};
