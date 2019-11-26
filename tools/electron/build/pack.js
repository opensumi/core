
const electronBuilder = require('electron-builder');
const path = require('path');
const fs = require('fs-extra');

electronBuilder.build({
  config: {
    productName: "Kaitian IDE",
    npmArgs: ['--registry=https://registry.npm.alibaba-inc.com'],
    electronVersion: "5.0.10",
    files:[
      "node_modules",
      "dist"
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