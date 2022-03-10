const path = require('path');

const electronBuilder = require('electron-builder');

const rootPackage = require('../package.json');

if (process.env.NODE_ENV !== 'production') {
  process.env.CSC_IDENTITY_AUTO_DISCOVERY = false;
}

electronBuilder.build({
  config: {
    productName: 'OpenSumi IDE',
    electronVersion: rootPackage.devDependencies.electron,
    files: ['app/dist'],
    extraResources: [
      {
        from: path.join(__dirname, '../extensions'),
        to: 'extensions',
        filter: ['**/*'],
      },
    ],
    asar: true,
    asarUnpack: 'node_modules/@opensumi/vscode-ripgrep',
    mac: {
      target: 'dmg',
    },
  },
});
