import { Emitter, isDevelopment } from '@ali/ide-core-common';
import * as net from 'net';
import {
  createSocketConnection,
  RPCServiceCenter,
  initRPCService,
  RPCProtocol,
} from '@ali/ide-connection';

const argv = require('yargs').argv;

async function initRPCProtocol(): Promise<RPCProtocol> {
  const extCenter = new RPCServiceCenter();
  const {getRPCService} = initRPCService(extCenter);
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

process.on('uncaughtException', (err) => {
  console.error('[Extension-Host][Uncaught Exception]', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[Extension-Host][Unhandle Rejection]', promise, 'reason:', reason);
});

if (isDevelopment()) {
  process.on('rejectionHandled', (err) => {
    console.error('[Extension-Host][Handled Rejection]', err);
  });
}
