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

const argv = require('yargs').argv;

async function initRPCProtocol(): Promise<RPCProtocol> {
  const extCenter = new RPCServiceCenter();
  const {getRPCService, createRPCService} = initRPCService(extCenter);
  const extConnection = net.createConnection(argv['kt-process-sockpath']);
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
}

(async () => {
  const protocol = await initRPCProtocol();
  if (argv['kt-process-preload']) {
    try {
    let Preload: any = require(argv['kt-process-preload']);
    if (Preload.default) {
      Preload = Preload.default;
    }

    const preload = new Preload(protocol);

    await preload.init();

    if (process && process.send) {
      process.send('ready');
    }
    } catch (e) {
      console.log(e);
    }
  }
})();

/*
initRPCProtocol().then((protocol) => {
  console.log('extProcess', process.argv, argv);
  if (argv['kt-process-preload']) {
    try {
    let Preload: any = require(argv['kt-process-preload']);
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
*/

process.on('uncaughtException', (err) => {
  console.error('[Extension-Host][Uncaught Exception]', err);
});
