const fs = require('fs');
const path = require('path');

exports.getAlias = () => {
  const packagesDir = path.join(__dirname, '../../packages');
  const packages = fs.readdirSync(packagesDir);

  const alias = {};
  for (const pkgName of packages) {
    const pkgDir = path.join(packagesDir, pkgName);
    const pkg = require(path.join(pkgDir, 'package.json'));
    alias[pkg.name] = path.join(pkgDir, 'src');
  }

  return alias;
}
