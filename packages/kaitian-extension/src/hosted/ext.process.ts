import { Emitter, isDevelopment, ReporterProcessMessage, LogLevel } from '@ali/ide-core-common';
import * as net from 'net';
import {
  createSocketConnection,
  RPCServiceCenter,
  initRPCService,
  RPCProtocol,
} from '@ali/ide-connection';
import { ExtensionLogger2 } from './extension-log2';
import { ProcessMessageType } from '../common';
import { isPromiseCanceledError } from '@ali/ide-core-common/lib/errors';
import { Injector } from '@ali/common-di';
import { AppConfig } from '@ali/ide-core-node';

// TODO: 注入自定义 class

const argv = require('yargs').argv;
let logger: any = console;

const extAppConfig = JSON.parse(argv['kt-app-config'] || '{}');

const extInjector = new Injector();
extInjector.addProviders({
  token: AppConfig,
  useValue: extAppConfig,
});

async function initRPCProtocol(): Promise<any> {
  const extCenter = new RPCServiceCenter();
  const { getRPCService } = initRPCService(extCenter);
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

  logger = new ExtensionLogger2(extInjector); // new ExtensionLogger(extProtocol);
  logger.log('process extConnection path', argv['kt-process-sockpath']);
  return {extProtocol, logger};
}

(async () => {
  const {extProtocol: protocol, logger} = await initRPCProtocol();
  // if (argv['kt-process-preload']) {

  // }
  try {
    let Preload: any = require('./ext.host');
    if (Preload.default) {
      Preload = Preload.default;
    }

    const preload = new Preload(protocol, logger);

    preload.onFireReporter((reportMessage: ReporterProcessMessage) => {
      if (process && process.send) {
        process.send({
          type: ProcessMessageType.REPORTER,
          data: reportMessage,
        });
      }
    });

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

function getErrorLogger() {
  return logger && logger.error.bind(logger) || console.error.bind(console);
}

function getWarnLogger() {
  return logger && logger.warn.bind(logger) || console.warn.bind(console);
}

function unexpectedErrorHandler(e) {
  setTimeout(() => {
    getErrorLogger()('[Extension-Host]', e.message, e.stack && '\n\n' + e.stack);
  }, 0);
}

function onUnexpectedError(e: any) {
  let err = e;
  if (!err) {
    getWarnLogger()(`Unknow Exception ${err}`);
    return;
  }

  if (isPromiseCanceledError(err)) {
    getWarnLogger()(`Canceled ${err.message}`);
    return;
  }

  if (!(err instanceof Error)) {
    err = new Error(e);
  }
  unexpectedErrorHandler(err);
}

process.on('uncaughtException', (err) => {
  onUnexpectedError(err);
});

const unhandledPromises: Promise<any>[] = [];
process.on('unhandledRejection', (reason, promise) => {
  unhandledPromises.push(promise);
  setTimeout(() => {
    const idx = unhandledPromises.indexOf(promise);
    if (idx >= 0) {
      promise.catch((e) => {
        unhandledPromises.splice(idx, 1);
        onUnexpectedError(e);
      });
    }
  }, 1000);
});

process.on('rejectionHandled', (promise: Promise<any>) => {
  const idx = unhandledPromises.indexOf(promise);
  if (idx >= 0) {
    unhandledPromises.splice(idx, 1);
  }
});
