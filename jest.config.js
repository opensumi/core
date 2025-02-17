const { pathsToModuleNameMapper } = require('ts-jest');

const tsconfig = require('./configs/ts/tsconfig.resolve.json');

const tsModuleNameMapper = pathsToModuleNameMapper(tsconfig.compilerOptions.paths, { prefix: '<rootDir>/configs/' });

/**
 * @type {import('@jest/types').Config.InitialOptions}
 */
const baseConfig = {
  preset: 'ts-jest',
  resolver: '<rootDir>/tools/dev-tool/src/jest-resolver.js',
  maxWorkers: 2,
  collectCoverageFrom: [
    'packages/*/src/**/*.ts',
    '!packages/**/*.contribution.ts',
    // 部分contribution文件为-contribution结尾
    '!packages/**/*-contribution.ts',
    '!packages/startup/**/*.ts',
    // Test 功能暂未完成
    '!packages/testing/**/*.ts',
    // notebook 包暂未编写测试且有包规范问题
    '!packages/notebook/**/*.ts',
    // CLI 不需要测试
    '!packages/remote-cli/**/*.ts',
    '!packages/core-electron-main/**/*.ts',
    '!packages/*/src/electron-main/**/*.ts',
  ],
  moduleNameMapper: {
    ...tsModuleNameMapper,
    '^vscode-languageserver-types$': '<rootDir>/node_modules/vscode-languageserver-types/lib/umd/main.js',
    '^ws$': '<rootDir>/node_modules/ws/index.js',
    '.*\\.(css|less)$': '<rootDir>/tools/dev-tool/src/mock-exports.js',
  },
  testPathIgnorePatterns: [
    '/dist/',
    '/node_modules/',
    '/tools/workspace/',
    '/tools/template/',
    '/tools/extensions/',
    '/packages/status-bar/entry',
    '/packages/startup/entry',
    '/__mocks__/',
    '/packages/quick-open/entry',
    // 终端渲染测试暂时不跟随单元测试
    '/packages/terminal-next/__tests__/browser/render.test.ts',
  ],
  modulePathIgnorePatterns: ['<rootDir>/dist/', '<rootDir>/tools/workspace/'],
  coveragePathIgnorePatterns: [
    '/dist/',
    '/node_modules/',
    '/mocks/',
    '/tools/template/',
    '/tools/workspace/',
    '/packages/startup/entry',
  ],
  coverageThreshold: {
    global: {
      branches: 0,
      functions: 0,
      lines: 0,
      statements: 0,
    },
  },
};

if (process.env.JEST_COVERAGE_PROVIDER) {
  baseConfig.coverageProvider = process.env.JEST_COVERAGE_PROVIDER;
}

/**
 * @type {import('@jest/types').Config.InitialOptions}
 */
module.exports = {
  ...baseConfig,
  coverageReporters: ['json', 'clover'],
  projects: [
    {
      ...baseConfig,
      displayName: 'node',
      testEnvironment: 'node',
      setupFiles: ['./jest.setup.node.js'],
      testMatch: [
        // 有个 webview 的 case 应该放在 electron 下测，也会被第一条规则匹配到
        // - packages/webview/__tests__/webview/webview.channel.test.ts
        '**/packages/*/__test?(s)__/!(browser)/**/?(*.)+(spec|test).[jt]s?(x)',
        '**/packages/{core-common,core-electron-main,core-node,utils,i18n}/__tests__/**/?(*.)+(spec|test).[jt]s?(x)',
        // exclude 的要放最后
        '!**/packages/{components,core-browser}/__tests__/**',
        '!**/packages/extension/__tests__/{hosted,common}/**',
      ],
    },
    {
      ...baseConfig,
      displayName: 'jsdom',
      testEnvironment: 'jsdom',
      testEnvironmentOptions: {
        html: `<html>
        <body>
          <div id="main"></div>
        </body>
        </html>`,
        runScripts: 'dangerously',
        url: 'http://localhost/?id=1',
        userAgent: `Mozilla/5.0 (${
          process.platform === 'darwin' ? 'Macintosh' : process.platform === 'win32' ? 'Windows' : 'Linux'
        }) AppleWebKit/537.36 (KHTML, like Gecko) jsdom/v16.7.0`,
      },
      setupFiles: ['./jest.setup.jsdom.js'],
      testMatch: [
        '**/packages/*/__test?(s)__/browser/**/?(*.)+(spec|test).[jt]s?(x)',
        '**/packages/*/__test?(s)__/common/**/?(*.)+(spec|test).[jt]s?(x)',
        '**/tools/*/__tests__/**/?(*.)+(spec|test).[jt]s?(x)',
        '**/packages/extension/__tests__/{hosted,common}/**/?(*.)+(spec|test).[jt]s?(x)',
        '**/packages/{components,core-browser,core-common,electron-basic}/__tests__/**/?(*.)+(spec|test).[jt]s?(x)',
      ],
      transformIgnorePatterns: ['/node_modules/(?!(@opensumi/monaco-editor-core)/)'],
      transform: {
        '^.+\\.(js)$': [
          'ts-jest',
          {
            isolatedModules: true,
            tsconfig: {
              allowJs: true,
              module: 'NodeNext',
              moduleResolution: 'node',
              esModuleInterop: true,
              skipLibCheck: true,
            },
          },
        ],
      },
    },
  ],
};
