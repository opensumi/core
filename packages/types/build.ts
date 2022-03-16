import path from 'path';

import { ensureFileSync, writeFileSync } from 'fs-extra';

import { collectPkgContains, collectPkgVersionList } from '../../scripts/manifest';
import { readAllMainPackages } from '../../scripts/pkg';

import pkg from './package.json';


(async () => {
  const manifestFile = path.join(__dirname, 'manifest.json');
  const packageDir = path.join(__dirname, '../../packages');
  const packages = readAllMainPackages(packageDir);
  const version = process.env.npm_package_version || pkg.version;
  const manifest = {
    meta: await collectPkgContains(packages, version),
    packages: collectPkgVersionList(packages, version),
  };
  ensureFileSync(manifestFile);
  writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`);
})();
