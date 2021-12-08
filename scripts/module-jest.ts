import { argv } from 'yargs';
import * as jest from 'jest';
import { pathsToModuleNameMapper } from 'ts-jest';
const tsconfig = require('../configs/ts/tsconfig.resolve.json');

const tsModuleNameMapper = pathsToModuleNameMapper(
  tsconfig.compilerOptions.paths,
  { prefix: '<rootDir>/configs/' },
);

const target: string | undefined = argv.module as any;

if (!target) {
  throw new Error('必须使用 --module参数 提供Module名称， 例子： npm run test:module -- --module=editor');
}

const config = createJestConfig(target);
const args: string[] = ['--coverage'];

args.push('--config', JSON.stringify(config));
jest.run(args);

function createJestConfig(module: string) {

  return {
    preset: 'ts-jest',
    testEnvironment: 'node',
    setupFiles: [
      './jest.setup.js',
      "jsdom-worker"
    ],
    collectCoverageFrom: [
      `packages/${module}/src/**/*.ts`,
      '!packages/**/*.contribution.ts',
      '!packages/startup/**/*.ts',
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
      '/packages/quick-open/entry',
    ],
    testMatch: [ `**/packages/${module}/**/` + '__tests__/**/*.test.[jt]s?(x)', `**/packages/${module}/` + '**/?(*.)+(spec|test).[jt]s?(x)' ],
    coverageThreshold: {
      global: {
        branches: 0,
        functions: 0,
        lines: 0,
        statements: 0,
      },
    },
  };

}
