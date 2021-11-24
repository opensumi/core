#!/usr/bin/env node
const path = require('path');

const readPkg = require('read-pkg');
const writePackage = require('write-pkg');

const cliEnginePath = path.resolve(process.cwd(), 'tools/cli-engine');

function boot() {
  const rootPkg = readPkg.sync({ cwd: process.cwd() });
  const targetVersion = rootPkg.version;
  const cliEnginePkg = readPkg.sync({ cwd: cliEnginePath });
  cliEnginePkg.version = targetVersion;
  Object.keys(cliEnginePkg.dependencies)
    .filter(n => n.startsWith('@opensumi/ide-'))
    .forEach(key => {
      cliEnginePkg.dependencies[key] = targetVersion;
    });
  writePackage.sync(cliEnginePath, cliEnginePkg);

  return targetVersion;
}

console.log(boot());
