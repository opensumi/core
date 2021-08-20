import { readAllMainPackages } from '../../scripts/pkg';
import {  collectPkgContains, collectPkgVersionList } from '../../scripts/kaitian-manifest';
import * as path from 'path';
import * as pkg from './package.json';
import { ensureFileSync, writeFileSync } from 'fs-extra';

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
