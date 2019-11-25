import { Emitter, isDevelopment } from '@ali/ide-core-common';
import * as net from 'net';
import {
  createSocketConnection,
  RPCServiceCenter,
  initRPCService,
  RPCProtocol,
} from '@ali/ide-connection';
import { ExtensionLogger } from './extension-log';

const argv = require('yargs').argv;
let logger: ExtensionLogger;

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

  logger = new ExtensionLogger(extProtocol);
  logger.log('process extConnection path', argv['kt-process-sockpath']);

  return extProtocol;
}

(async () => {
  const protocol = await initRPCProtocol();
  // if (argv['kt-process-preload']) {

  // }
  try {
    let Preload: any = require('./ext.host');
    if (Preload.default) {
      Preload = Preload.default;
    }

    const preload = new Preload(protocol);
    logger!.log('preload.init start');
    await preload.init();
    logger!.log('preload.init end');

    if (process && process.send) {
      const send = process.send;
      process.send('ready');

      process.on('message', async (msg) => {
        if (msg === 'close') {
          logger!.log('preload.close start');
          await preload.close();
          logger!.log('preload.close end');
          if (process && process.send) {
            process.send('finish');
          }
        }
      });

    }

    } catch (e) {
      logger!.error(e);
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
