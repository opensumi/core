const { pathsToModuleNameMapper } = require('ts-jest/utils')
const tsconfig = require('./configs/ts/tsconfig.resolve.json')

const tsModuleNameMapper = pathsToModuleNameMapper(
  tsconfig.compilerOptions.paths,
  { prefix: '<rootDir>/configs/' },
)

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  setupFiles: [
    "./jest.setup.js"
  ],
  collectCoverageFrom: [
    "packages/*/src/**/*.ts",
    "!packages/**/*.contribution.ts",
    "!packages/startup/**/*.ts",
    "!packages/kaitian-extension/**/*.ts",
    "!packages/core-electron-main/**/*.ts",
    "!packages/*/src/electron-main/**/*.ts",
  ],
  moduleNameMapper: {
    ...tsModuleNameMapper,
    '.*\\.(css|less)$': '<rootDir>/tools/dev-tool/src/mock-exports.js'
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
    '/packages/quick-open/entry'
  ],
  coveragePathIgnorePatterns: [
    '/dist/',
    '/node_modules/',
    '/__test__/',
    '/mocks/',
    '/tools/template/',
    '/tools/workspace/',
    '/packages/status-bar/entry',
    '/packages/startup/entry',
    '/packages/quick-open/entry'
  ],
  transform: {
    "^.+\\.(css|less)$": "<rootDir>/mocks/style-mock.js"
   },
  testMatch: [ "**/__tests__/**/*.test.[jt]s?(x)", "**/?(*.)+(spec|test).[jt]s?(x)" ],
  coverageThreshold: {
    global: {
      branches: 0,
      functions: 0,
      lines: 0,
      statements: 0
    }
  }
};
