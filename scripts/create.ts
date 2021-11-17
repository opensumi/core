import { createPackage } from './fn/create-package';
const newPackage = process.argv[2];

if (!newPackage) {
  throw Error('newPackage is required.');
}

createPackage(newPackage);
