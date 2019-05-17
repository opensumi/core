const { pathsToModuleNameMapper } = require('ts-jest/utils')
const tsconfig = require('./configs/ts/tsconfig.resolve.json')

const moduleNameMapper = pathsToModuleNameMapper(
  tsconfig.compilerOptions.paths,
  { prefix: '<rootDir>/configs/' },
)

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper,
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/__test__/',
    '/tool/template/',
    '/packages/core-common'
  ],
  coverageThreshold: {
    global: {
      branches: 0,
      functions: 0,
      lines: 0,
      statements: 0
    }
  }
};
