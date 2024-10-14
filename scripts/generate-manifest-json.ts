import { join } from 'path';

import { ensureFileSync, readFileSync, writeFileSync } from 'fs-extra';

import { argv } from '../packages/core-common/src/node/cli';

import { generateManifest } from './manifest';
import Package, { readAllMainPackages } from './pkg';

// yarn run manifest -v=2.19.0
const version = argv.v as string;
const localManifest = join(__dirname, '../packages/types/manifest.json');
if (!version) {
  throw new Error('version is required');
}

const packages: Package[] = readAllMainPackages();
generateManifest(packages, version).then((manifest) => updateFileWithDispose(localManifest, manifest));

function updateFileWithDispose(filePath: string, content: any | ((original: string) => any)) {
  ensureFileSync(filePath);
  const original = readFileSync(filePath, { encoding: 'utf8' });
  let newContent = content;
  if (typeof content === 'function') {
    newContent = content(original);
  }
  writeFileSync(filePath, `${JSON.stringify(newContent, null, 2)}\n`);
}
