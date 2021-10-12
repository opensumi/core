const electronBuilder = require('electron-builder');
const path = require('path');
const rootPackage = require('../package.json');

electronBuilder.build({
  config: {
    productName: "Kaitian IDE",
    npmArgs: ['--registry=https://registry.npm.alibaba-inc.com'],
    electronVersion: rootPackage.devDependencies.electron,
    files:[
      "app/dist"
    ],
    extraResources:[
      {
        "from": path.join(__dirname, "../extensions"),
        "to": "extensions",
        filter: ['**/*'],
      }
    ],
    asar: true,
    asarUnpack: 'node_modules/@ali/vscode-ripgrep',
    mac: {
      target:'dmg',
    },
  }
})