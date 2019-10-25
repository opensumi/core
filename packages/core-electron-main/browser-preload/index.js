const ipcRenderer = require('electron').ipcRenderer;
const browserWindow = require('electron').remote.getCurrentWindow();
const net = require('net')
const { dirname, join } = require('path');

console.log('preload')

const listenPathDeffered = new Promise((resolve)=>{
  listenPathDefferedResolve = resolve
})


ipcRenderer.on('preload:listenPath', (e, msg)=>{
  console.log('msg', msg)
  listenPath = msg
  listenPathDefferedResolve(msg)
})


function createRPCNetConnection(){
  return listenPathDeffered.then((listenPath)=>{
    return net.createConnection(listenPath)
  })
}


function createNetConnection(connectPath){
  return net.createConnection(connectPath)
}

const electronEnv = {};

electronEnv.ElectronIpcRenderer = ipcRenderer;
electronEnv.createNetConnection = createNetConnection;
electronEnv.createRPCNetConnection = createRPCNetConnection;
electronEnv.oniguruma = require('oniguruma');
electronEnv.platform = require('os').platform();
electronEnv.isElectronRenderer = true;
electronEnv.BufferBridge = Buffer
electronEnv.currentWebContentsId = require('electron').remote.getCurrentWebContents().id;
electronEnv.currentWindowId = require('electron').remote.getCurrentWindow().id;
electronEnv.monacoPath = join (dirname(require.resolve('monaco-editor-core/package.json')));
electronEnv.appPath = require('electron').remote.app.getAppPath();


const metaData = JSON.parse(ipcRenderer.sendSync('window-metadata', electronEnv.currentWindowId));
electronEnv.metadata = metaData; 
process.env = Object.assign({}, process.env, metaData.env, {WORKSPACE_DIR: metaData.workspace});

electronEnv.env = Object.assign({}, process.env);
electronEnv.webviewPreload = metaData.webview.webviewPreload,
electronEnv.plainWebviewPreload = metaData.webview.plainWebviewPreload,
electronEnv.env.EXTENSION_DIR = metaData.extensionDir[0];

global.electronEnv = electronEnv;
Object.assign(global, electronEnv);

if (metaData.preloads) {
  metaData.preloads.forEach((preload) => {
    require(preload);
  })
}


electronEnv.isMaximized = () => { return browserWindow.isMaximized() };

