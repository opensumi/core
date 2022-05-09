const { resolve, basename, join, dirname } = require('path');
const { existsSync, symlinkSync, mkdirSync, readdirSync, readFileSync, unlinkSync } = require('fs');

const frameworkDir = resolve('../../');

function ensureDirSync(path) {
  if (!existsSync(path)) {
    mkdirSync(path);
  }
}

function linkNodeModules(moduleDir, targetParent) {
  let name = basename(moduleDir);
  if (name.startsWith('_')) {
    return;
  }
  if (name.startsWith('@') || name === 'node_modules') {
    const target = join(targetParent, name);
    ensureDirSync(target);
    readdirSync(moduleDir).forEach((dir) => {
      linkNodeModules(join(moduleDir, dir), target);
    });
  } else {
    const target = join(targetParent, name);
    if (!existsSync(target)) {
      try {
        unlinkSync(target); //失效link
      } catch (e) {
        // ignore
      }

      symlinkSync(moduleDir, target);
    }
  }
}

linkNodeModules(join(frameworkDir, '/node_modules'), resolve('./'));

function linkPackages(packagesDir, targetParent) {
  readdirSync(packagesDir).forEach((packageName) => {
    if (packageName.startsWith('.')) {
      return;
    }
    if (!existsSync(join(packagesDir, packageName, 'package.json'))) {
      return;
    }
    const name = JSON.parse(readFileSync(join(packagesDir, packageName, 'package.json'), 'utf8').toString()).name;
    const target = join(targetParent, name);
    try {
      unlinkSync(target); //失效link
    } catch (e) {
      // ignore
    }
    ensureDirSync(dirname(target));
    symlinkSync(join(packagesDir, packageName), target);
  });
}

linkPackages(join(frameworkDir, '/packages'), resolve('./node_modules'));
