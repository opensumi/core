const { execSync } = require("child_process");
const { pathExistsSync, copySync, removeSync } = require("fs-extra");
const { basename, join } = require('path');
const argv = require('yargs').argv;
const fs = require('fs')


const nativeModules = [
  join(__dirname, '../node_modules/node-pty'),
  join(__dirname, '../node_modules/nsfw'),
  join(__dirname, '../node_modules/spdlog')
]

let commands;

const target = argv.target || 'node';
let version;

if (target === 'electron') {

  version = argv.electronVersion || require('electron/package.json').version;

  console.log('rebuilding native for electron version ' + version);

  commands = [require('os').arch === 'win32' ? 'set HOME=~/.electron-gyp':'HOME=~/.electron-gyp','node-gyp','rebuild',`--target=${version}`,'--arch=x64','--dist-url=https://electronjs.org/headers', 'openssl_fips=X']

} else if (target === 'node') {

  console.log('rebuilding native for node version ' + process.version);

  version = process.version;

  commands = ['node-gyp', 'rebuild']

}

function rebuildModule(modulePath, type, version) {
  const info = require(join(modulePath,'./package.json'));
  console.log('rebuilding ' + info.name)
  const cache = getBuildCacheDir(modulePath, type, version, target);
  if (pathExistsSync(cache) && !argv['force-rebuild']) {
    console.log('cache found for ' + info.name)
    copySync(cache, join(modulePath, 'build'));
  }
  else {
    execSync(commands.join(' '), {
      cwd: modulePath
    });
    removeSync(cache);
    copySync(join(modulePath, 'build'), cache);
  }

}

function getBuildCacheDir(modulePath, type, version, target) {
  const info = require(join(modulePath,'./package.json'));
  return join(require('os').tmpdir(), 'ide_build_cache', target, info.name + '-' + info.version , type + '-' + version);
}


nativeModules.forEach(path => {
  rebuildModule(path, target, version);
})
