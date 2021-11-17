const electronBuilder = require('electron-builder');
const path = require('path');
const rootPackage = require('../package.json');

electronBuilder.build({
  config: {
    productName: "KAITIAN IDE",
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
    asarUnpack: 'node_modules/vscode-ripgrep',
    mac: {
      target:'dmg',
    },
  }
})