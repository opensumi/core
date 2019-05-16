module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
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
