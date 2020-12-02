const ipcRenderer = require('electron').ipcRenderer;
const net = require('net');
const { dirname, join } = require('path');

const electronEnv = {};

const urlParams = new URLSearchParams(decodeURIComponent(window.location.search));
const windowId = Number(urlParams.get('windowId'));
const webContentsId = Number(urlParams.get('webContentsId'));

async function createRPCNetConnection () {
  const rpcListenPath = ipcRenderer.sendSync('window-rpc-listen-path', electronEnv.currentWindowId);
  return net.createConnection(rpcListenPath);
}

function createNetConnection (connectPath) {
  return net.createConnection(connectPath);
}

electronEnv.ElectronIpcRenderer = ipcRenderer;
electronEnv.createNetConnection = createNetConnection;
electronEnv.createRPCNetConnection = createRPCNetConnection;
electronEnv.oniguruma = require('oniguruma');
electronEnv.platform = require('os').platform();

electronEnv.isElectronRenderer = true;
electronEnv.BufferBridge = Buffer;
electronEnv.currentWindowId = windowId;
electronEnv.currentWebContentsId = webContentsId;
electronEnv.monacoPath = join(dirname(require.resolve('monaco-editor-core/package.json')));
electronEnv.appPath = require('electron').remote.app.getAppPath();

const metaData = JSON.parse(ipcRenderer.sendSync('window-metadata', electronEnv.currentWindowId));

electronEnv.metadata = metaData;
process.env = Object.assign({}, process.env, metaData.env, { WORKSPACE_DIR: metaData.workspace });

electronEnv.env = Object.assign({}, process.env);
electronEnv.webviewPreload = metaData.webview.webviewPreload;
electronEnv.plainWebviewPreload = metaData.webview.plainWebviewPreload;
electronEnv.env.EXTENSION_DIR = metaData.extensionDir[0];

global.electronEnv = electronEnv;
Object.assign(global, electronEnv);

if (metaData.preloads) {
  metaData.preloads.forEach((preload) => {
    require(preload);
  });
}
