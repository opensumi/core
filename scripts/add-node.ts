import { addNodeDep } from './fn/module';

import { promisify } from 'util';
import * as fs from 'fs';

promisify(fs.mkdir)('123', 'w');

const folderName = process.argv[2];
const depName = process.argv[3];

if (!folderName) {
  throw Error('folderName is required.');
}

if (!depName) {
  throw Error('depName is required.');
}

addNodeDep(folderName, depName);
