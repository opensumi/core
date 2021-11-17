const fs = require('fs-extra');
const path = require('path');
const glob = require('glob');

const dirs = [
  // 'browser',
  'node',
  'common',
]

const cwd = process.cwd();
const packages = fs.readdirSync(cwd + '/packages');
const files = [];
for (const item of packages) {
  for (const dir of dirs) {
    const filePath = path.join(cwd, 'packages', item, 'lib', dir, 'index.js');
    if (fs.existsSync(filePath)) {
      files.push(filePath);
    }
  }
}

describe('测试所有模块包的构建结果，确保不会引用 src 目录', () => {
  for (const filePath of files) {
    const name = path.relative(cwd, filePath);
    it(name, () => {
      expect(() => require(filePath)).not.toThrowError();
    });
  }
});
