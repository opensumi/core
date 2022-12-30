const { execSync } = require('child_process');
const { pathExistsSync, copySync, removeSync } = require('fs-extra');
const { join } = require('path');
const os = require('os');
const mri = require('mri');

const argv = mri(process.argv.slice(2));

const nativeModules = [
  join(__dirname, '../node_modules/node-pty'),
  join(__dirname, '../node_modules/@parcel/watcher'),
  join(__dirname, '../node_modules/spdlog'),
  join(__dirname, '../node_modules/keytar'),
];

let commands;

const target = argv.target || 'node';
const arch = argv.arch || os.arch();
const force = argv['force-rebuild'] || argv.force;
let version;

if (target === 'electron') {
  version = argv.electronVersion || require('electron/package.json').version;
  console.log('rebuilding native for electron version ' + version);
  commands = [
    os.platform() === 'win32' ? 'set HOME=~/.electron-gyp' : 'HOME=~/.electron-gyp',
    'node-gyp',
    'rebuild',
    '--openssl_fips=X',
    `--target=${version}`,
    `--arch=${arch}`,
    '--dist-url=https://electronjs.org/headers',
  ];
} else if (target === 'node') {
  console.log('rebuilding native for node version ' + process.version);
  version = process.version;
  commands = ['node-gyp', 'rebuild'];
}

function rebuildModule(modulePath, type, version, arch) {
  const info = require(join(modulePath, './package.json'));
  console.log(`rebuilding ${info.name}: ${info.version} for arch ${arch}`);
  const cache = getBuildCacheDir(modulePath, type, version, arch);
  console.log(`cache dir ${cache}`);
  if (pathExistsSync(cache) && !force) {
    try {
      console.log('cache found for ' + info.name);
      removeSync(join(modulePath, 'build'));

      if (process.platform === 'linux') {
        execSync(`cp -r ${cache} ${join(modulePath, 'build')}`);
      } else {
        copySync(cache, join(modulePath, 'build'), { dereference: true, recursive: true });
      }

      return;
    } catch (error) {
      console.log('cache restore error', error);
      console.log('build from source');
    }
  }
  console.log(`running command ${commands.join(' ')}`);
  execSync(commands.join(' '), {
    cwd: modulePath,
    stdio: 'inherit',
  });
  removeSync(cache);
  copySync(join(modulePath, 'build'), cache, { dereference: true, recursive: true });
}

function getBuildCacheDir(modulePath, type, version, arch) {
  const info = require(join(modulePath, './package.json'));
  return join(
    require('os').tmpdir(),
    'opensumi_build_cache',
    `${type}-${version}-${arch}`,
    info.name + '-' + info.version,
  );
}

nativeModules.forEach((path) => {
  rebuildModule(path, target, version, arch);
});
