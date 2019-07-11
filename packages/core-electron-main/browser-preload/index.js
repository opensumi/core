const ipcRenderer = require('electron').ipcRenderer;
const net = require('net')

const {
  RPCServiceCenter,
  initRPCService,
  createSocketConnection
} = require('@ali/ide-connection')

console.log('preload')

const listenPathDeffered = new Promise((resolve)=>{
  listenPathDefferedResolve = resolve
})


ipcRenderer.on('preload:listenPath', (e, msg)=>{
  console.log('msg', msg)
  listenPath = msg
  listenPathDefferedResolve(msg)
})

function createConnection(injector, modules){
  return listenPathDeffered.then((listenPath)=>{
    const clientCenter = new RPCServiceCenter()
    console.log('listenPath', listenPath)
    const connection = net.createConnection(listenPath)
    clientCenter.setConnection(createSocketConnection(connection))
  
    const {getRPCService} = initRPCService(clientCenter)
  
    const backServiceArr = [];
  
    for (const module of modules) {
      const moduleInstance = injector.get(module);
      if (moduleInstance.backServices) {
        for (const backService of moduleInstance.backServices) {
          backServiceArr.push(backService);
        }
      }
    }
  
    for (const backService of backServiceArr) {
      const { servicePath: backServicePath } = backService;
      const getService = getRPCService(backServicePath);
  
      const injectService = {
        token: backServicePath,
        useValue: getService,
      };
  
      injector.addProviders(injectService);
  
      if (backService.clientToken) {
        const clientService = injector.get(backService.clientToken);
        getService.onRequestService(clientService);
      }
    }
  })
}

window.global = window;
window.ElectronIpcRenderer = ipcRenderer;
window.createConnection = createConnection
window.oniguruma = require('oniguruma');
window.platform = require('os').platform();
window.isElectronRenderer = true;
window.env = process.env;
window.currentWebContentsId = require('electron').remote.getCurrentWebContents().id;
