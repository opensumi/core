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


function createRPCNetConnection(){
  return listenPathDeffered.then((listenPath)=>{
    return net.createConnection(listenPath)
  })
}

function createNetConnection(connectPath){
  return net.createConnection(connectPath)
}

window.global = window;
window.ElectronIpcRenderer = ipcRenderer;
window.createRPCNetConnection = createRPCNetConnection;
window.createNetConnection = createNetConnection;
window.oniguruma = require('oniguruma');
window.platform = require('os').platform();
window.isElectronRenderer = true;
window.BufferBridge = Buffer
window.env = process.env;
window.currentWebContentsId = require('electron').remote.getCurrentWebContents().id;
window.currentWindowId = require('electron').remote.getCurrentWindow().id;
