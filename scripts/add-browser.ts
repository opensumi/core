import { addBrowserDep } from './fn/module';

const folderName = process.argv[2];
const depName = process.argv[3];

if (!folderName) {
  throw Error('folderName is required.');
}

if (!depName) {
  throw Error('depName is required.');
}

addBrowserDep(depName);
