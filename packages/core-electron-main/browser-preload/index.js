const ipcRenderer = require('electron').ipcRenderer;
const net = require('net')
import {
  RPCServiceCenter,
  initRPCService,
  createSocketConnection
} from '@ali/ide-connection'

console.log('preload')

function createConnection(injector, modules){
  const clientCenter = new RPCServiceCenter()
  const connection = net.createConnection(`/Users/franklife/.kt_rpc_sock`)
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

  
}

window.global = window;
window.ElectronIpcRenderer = ipcRenderer;
window.createConnection = createConnection