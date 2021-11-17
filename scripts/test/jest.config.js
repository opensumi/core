const path = require('path');
const mockExports = path.join(process.cwd(), '/tools/dev-tool/src/mock-exports.js');

module.exports = {
  testMatch: ['**/build.js'],
  moduleNameMapper: {
    '.*\\.(css|less)$': mockExports,
  },
};
