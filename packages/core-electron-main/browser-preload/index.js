const ipcRenderer = require('electron').ipcRenderer;
const net = require('net')


console.log('preload')

const listenPathDeffered = new Promise((resolve)=>{
  listenPathDefferedResolve = resolve
})


ipcRenderer.on('preload:listenPath', (e, msg)=>{
  console.log('msg', msg)
  listenPath = msg
  listenPathDefferedResolve(msg)
})


function createNetConnection(){
  return listenPathDeffered.then((listenPath)=>{
    return net.createConnection(listenPath)
  })
}

const electronEnv = {};

electronEnv.ElectronIpcRenderer = ipcRenderer;
electronEnv.createNetConnection = createNetConnection;
electronEnv.oniguruma = require('oniguruma');
electronEnv.platform = require('os').platform();
electronEnv.isElectronRenderer = true;
electronEnv.BufferBridge = Buffer
electronEnv.env = process.env;
electronEnv.currentWebContentsId = require('electron').remote.getCurrentWebContents().id;
electronEnv.currentWindowId = require('electron').remote.getCurrentWindow().id;

global.electronEnv = electronEnv;
Object.assign(global, electronEnv);
