const { pathsToModuleNameMapper } = require('ts-jest');

const tsconfig = require('./configs/ts/tsconfig.resolve.json');

const tsModuleNameMapper = pathsToModuleNameMapper(tsconfig.compilerOptions.paths, { prefix: '<rootDir>/configs/' });
const baseConfig = {
  preset: 'ts-jest',
  testRunner: 'jest-jasmine2',
  resolver: '<rootDir>/tools/dev-tool/src/jest-resolver.js',
  // coverageProvider: process.env.JEST_COVERAGE_PROVIDER || 'v8',
  // https://dev.to/vantanev/make-your-jest-tests-up-to-20-faster-by-changing-a-single-setting-i36
  maxWorkers: '50%',
  moduleNameMapper: {
    ...tsModuleNameMapper,
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
  coverageThreshold: {
    global: {
      branches: 0,
      functions: 0,
      lines: 0,
      statements: 0,
    },
  },
};
/**
 * @type {import('@jest/types').Config.InitialOptions}
 */
module.exports = {
  ...baseConfig,
  projects: [
    {
      ...baseConfig,
      displayName: 'node',
      testEnvironment: 'node',
      setupFiles: ['./jest.setup.node.js'],
      testMatch: [
        // 有个 webview 的 case 应该放在 electron 下测，也会被第一条规则匹配到
        // - packages/webview/__tests__/webview/webview.channel.test.ts
        '**/packages/*/__test(s)?__/!(browser)/**/?(*.)+(spec|test).[jt]s?(x)',
        '**/packages/{core-common,core-electron-main,core-node,electron-basic,utils,i18n}/__tests__/**/?(*.)+(spec|test).[jt]s?(x)',
        // exclude 的要放最后
        '!**/packages/{components,core-browser}/__tests__/**',
        '!**/packages/extension/__tests__/hosted/**',
      ],
    },
    {
      ...baseConfig,
      displayName: 'jsdom',
      testEnvironment: 'jsdom',
      testEnvironmentOptions: {
        html: `<html>
        <div id="main"></div>
        </html>`,
        runScripts: 'dangerously',
        url: 'http://localhost/?id=1',
        userAgent: `Mozilla/5.0 (${
          process.platform === 'darwin' ? 'Macintosh' : process.platform === 'win32' ? 'Windows' : 'Linux'
        }) AppleWebKit/537.36 (KHTML, like Gecko) jsdom/v16.7.0`,
      },
      setupFiles: ['./jest.setup.jsdom.js'],
      testMatch: [
        '**/packages/*/__test(s)?__/browser/**/?(*.)+(spec|test).[jt]s?(x)',
        '**/packages/*/__test(s)?__/common/**/?(*.)+(spec|test).[jt]s?(x)',
        '**/tools/*/__tests__/**/?(*.)+(spec|test).[jt]s?(x)',
        '**/packages/extension/__tests__/hosted/**/?(*.)+(spec|test).[jt]s?(x)',
        '**/packages/{components,core-browser,core-common}/__tests__/**/?(*.)+(spec|test).[jt]s?(x)',
      ],
    },
  ],
};
