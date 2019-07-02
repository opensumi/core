import {Emitter} from '@ali/ide-core-common';
import * as net from 'net';
import * as path from 'path';
import {
  createSocketConnection,
  RPCServiceCenter,
  initRPCService,
  RPCProtocol,
  ProxyIdentifier,
} from '@ali/ide-connection';
import {extServerListenPath} from './index';
import {ExtensionScanner, IExtensionCandidate} from './extension.scaner';
import {ExtHostAPIIdentifier, IRPCProtocol} from '../common';

import {ExtHostCommands} from './api/extHostCommand';

console.log('fork ext process');

// TODO: $loadPlugin
// TODO: $activate

async function initRPCProtocol(): Promise<RPCProtocol> {
  const extCenter = new RPCServiceCenter();
  const {getRPCService, createRPCService} = initRPCService(extCenter);
  const extConnection = net.createConnection(extServerListenPath);
  extCenter.setConnection(createSocketConnection(extConnection));

  const service = getRPCService('ExtProtocol');
  const onMessageEmitter = new Emitter<string>();
  service.on('onMessage', (msg) => {
    onMessageEmitter.fire(msg);
  });
  const onMessage = onMessageEmitter.event;
  const send = service.onMessage;

  const extProtocol = new RPCProtocol({
    onMessage,
    send,
  });

  return extProtocol;

  // 测试代码
  /*
  setTimeout(async () => {
    const commandIdentifier = new ProxyIdentifier( 'CommandRegistry');
    const proxy = extProtocol.getProxy(commandIdentifier);

    const result = await proxy.$getCommands();
    console.log('ext protocol result', result);
  });
  */
}

initRPCProtocol().then((protocol) => {
  const argv = require('yargs').argv;
  console.log('extProcess', process.argv, argv);
  if (argv['process-preload']) {
    try {
    let Preload: any = require(argv['process-preload']);
    if (Preload.default) {
      Preload = Preload.default;
    }
    console.log('Preload', Preload);

    const preload = new Preload(protocol);

    preload.init();
    } catch (e) {
      console.log(e);
    }
  }

});
