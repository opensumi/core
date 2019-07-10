const ipcRenderer = require('electron').ipcRenderer;

window.global = window;
window.ElectronIpcRenderer = ipcRenderer;
