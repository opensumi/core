const ipcRenderer = require('electron').ipcRenderer;

window.global = window;
window.ElectronIpcRenderer = ipcRenderer;
window.oniguruma = require('oniguruma');
window.platform = require('os').platform();
window.isElectronRenderer = true;
window.env = process.env;
window.currentWebContentsId = require('electron').remote.getCurrentWebContents().id;
