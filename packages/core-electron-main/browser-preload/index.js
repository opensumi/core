const net = require('net');
const os = require('os');

const { ipcRenderer } = require('electron');

const electronEnv = {};

const urlParams = new URLSearchParams(decodeURIComponent(window.location.search));
window.id = Number(urlParams.get('windowId'));
const webContentsId = Number(urlParams.get('webContentsId'));

function createRPCNetConnection() {
  const rpcListenPath = ipcRenderer.sendSync('window-rpc-listen-path', electronEnv.currentWindowId);
  return net.createConnection(rpcListenPath);
}

function createNetConnection(connectPath) {
  return net.createConnection(connectPath);
}

function getSocketConnection(connectPath) {
  let socket;
  if (connectPath) {
    socket = createNetConnection(connectPath);
  } else {
    socket = createRPCNetConnection();
  }
  const { createSocketConnection } = require('@opensumi/ide-connection/lib/node');
  return createSocketConnection(socket);
}

electronEnv.ElectronIpcRenderer = ipcRenderer;
electronEnv.createNetConnection = createNetConnection;
electronEnv.createRPCNetConnection = createRPCNetConnection;
electronEnv.getSocketConnection = getSocketConnection;

electronEnv.platform = os.platform();

electronEnv.isElectronRenderer = true;
electronEnv.BufferBridge = Buffer;
electronEnv.currentWindowId = window.id;
electronEnv.currentWebContentsId = webContentsId;
electronEnv.onigWasmPath = require.resolve('vscode-oniguruma/release/onig.wasm');

const metaData = JSON.parse(ipcRenderer.sendSync('window-metadata', electronEnv.currentWindowId));

electronEnv.metadata = metaData;
process.env = Object.assign({}, process.env, metaData.env, { WORKSPACE_DIR: metaData.workspace });

electronEnv.appPath = metaData.appPath;
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
