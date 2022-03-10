const os = require('os');

const { pathsToModuleNameMapper } = require('ts-jest');

const tsconfig = require('./configs/ts/tsconfig.resolve.json');

const tsModuleNameMapper = pathsToModuleNameMapper(tsconfig.compilerOptions.paths, { prefix: '<rootDir>/configs/' });

module.exports = {
  preset: 'ts-jest',
  testRunner: 'jest-jasmine2',
  testEnvironment: 'node',
  coverageProvider: process.env.JEST_COVERAGE_PROVIDER || 'babel',
  maxWorkers: process.env.SIGMA_MAX_PROCESSORS_LIMIT || os.cpus().length,
  setupFiles: ['./jest.setup.js'],
  collectCoverageFrom: [
    'packages/*/src/**/*.ts',
    '!packages/**/*.contribution.ts',
    // 部分contribution文件为-contribution结尾
    '!packages/**/*-contribution.ts',
    '!packages/startup/**/*.ts',
    // Test 功能暂未完成
    '!packages/testing/**/*.ts',
    // CLI 不需要测试
    '!packages/remote-cli/**/*.ts',
    '!packages/core-electron-main/**/*.ts',
    '!packages/*/src/electron-main/**/*.ts',
  ],
  moduleNameMapper: {
    ...tsModuleNameMapper,
    '.*\\.(css|less)$': '<rootDir>/tools/dev-tool/src/mock-exports.js',
  },
  testPathIgnorePatterns: [
    '/dist/',
    '/packages/feature-extension/test/fixture/',
    '/packages/vscode-extension/test/fixture/',
    '/tools/workspace/',
    '/tools/extensions/',
    '/tools/candidate-ext/',
    '/packages/status-bar/entry',
    '/packages/startup/entry',
    '/packages/quick-open/entry',
    // 终端渲染测试暂时不跟随单元测试
    '/packages/terminal-next/__tests__/browser/render.test.ts',
    // ci 环境可能无法正常创建 pty 后端，需要 mock 一下 service
    // '/packages/terminal-next/__tests__/browser/client.test.ts',
    // componets下的 utils 均引用自 @opensumi/ide-core-common 模块，无须重复测试
    // 后续统一至 @opensumi/ide-utils 模块
    '/packages/components/src/utils',
  ],
  modulePathIgnorePatterns: ['<rootDir>/dist/'],
  coveragePathIgnorePatterns: [
    '/dist/',
    '/node_modules/',
    '/__test__/',
    '/mocks/',
    '/tools/template/',
    '/tools/workspace/',
    '/packages/status-bar/entry',
    '/packages/startup/entry',
    '/packages/quick-open/entry',
    // componets下的 utils 均引用自 @opensumi/ide-core-common 模块，无须重复测试
    // 后续统一至 @opensumi/ide-utils 模块
    '/packages/components/src/utils',
  ],
  testMatch: ['**/__tests__/**/*.test.[jt]s?(x)', '**/?(*.)+(spec|test).[jt]s?(x)'],
  coverageThreshold: {
    global: {
      branches: 0,
      functions: 0,
      lines: 0,
      statements: 0,
    },
  },
};
