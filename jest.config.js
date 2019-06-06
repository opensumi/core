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
  moduleNameMapper: {
    ...tsModuleNameMapper,
    '.*\\.(css|less)$': '<rootDir>/tools/dev-tool/src/mock-exports.js'
  },
  testPathIgnorePatterns: [
    '/dist/',
  ],
  coveragePathIgnorePatterns: [
    '/dist/',
    '/node_modules/',
    '/__test__/',
    '/tool/template/',
    '/packages/core-common',
  ],
  transform: { "^.+\\.(css|less)$": "<rootDir>/mocks/style-mock.js" },
  coverageThreshold: {
    global: {
      branches: 0,
      functions: 0,
      lines: 0,
      statements: 0
    }
  }
};
