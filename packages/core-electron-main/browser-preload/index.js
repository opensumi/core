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

window.global = window;
window.ElectronIpcRenderer = ipcRenderer;
window.createNetConnection = createNetConnection;
window.oniguruma = require('oniguruma');
window.platform = require('os').platform();
window.isElectronRenderer = true;
window.BufferBridge = Buffer
window.env = process.env;
window.currentWebContentsId = require('electron').remote.getCurrentWebContents().id;
window.currentWindowId = require('electron').remote.getCurrentWindow().id;
