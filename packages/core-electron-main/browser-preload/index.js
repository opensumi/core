const ipcRenderer = require('electron').ipcRenderer;
const net = require('net')
const { dirname, join } = require('path');

const isDev = true; //TODO 

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
electronEnv.monacoPath = join (dirname(require.resolve('monaco-editor-core/package.json')), isDev? 'dev': 'min');
const metaData = JSON.parse(ipcRenderer.sendSync('window-metadata', electronEnv.currentWindowId));
electronEnv.metadata = metaData; 
process.env = Object.assign({}, process.env, metaData.env, {WORKSPACE_DIR: metaData.workspace});

electronEnv.env = Object.assign({}, process.env);


global.electronEnv = electronEnv;
Object.assign(global, electronEnv);
console.log(global.electronEnv.env)

if (metaData.preloads) {
  metaData.preloads.forEach((preload) => {
    require(preload);
  })
}
