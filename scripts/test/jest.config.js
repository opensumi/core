const path = require('path');
const mockExports = path.join(process.cwd(), '/tools/dev-tool/src/mock-exports.js');

module.exports = {
  testMatch: ['**/build.js'],
  moduleNameMapper: {
    '^vscode-languageserver-types$': '<rootDir>/node_modules/vscode-languageserver-types/lib/umd/main.js',
    '.*\\.(css|less)$': mockExports,
  },
};
