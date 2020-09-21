import { ExtensionWorkerHost, initRPCProtocol } from './worker.host';

(() => {
  const protocol = initRPCProtocol();

  new ExtensionWorkerHost(protocol);
})();
