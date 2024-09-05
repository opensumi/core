import net from 'net';
import { performance } from 'perf_hooks';

import { Injector } from '@opensumi/di';
import { SumiConnectionMultiplexer, createExtMessageIO } from '@opensumi/ide-connection';
import { NetSocketConnection } from '@opensumi/ide-connection/lib/common/connection';
import {
  Emitter,
  IReporter,
  ReporterProcessMessage,
  isPromiseCanceledError,
  locale,
  setLanguageId,
} from '@opensumi/ide-core-common';
import { suppressNodeJSEpipeError } from '@opensumi/ide-core-common/lib/node';
import { argv } from '@opensumi/ide-core-common/lib/node/cli';

import { IExtensionHostService, KT_APP_CONFIG_KEY, KT_PROCESS_SOCK_OPTION_KEY, ProcessMessageType } from '../common';
import { ExtHostAppConfig, ExtProcessConfig } from '../common/ext.process';
import { knownProtocols } from '../common/vscode/protocols';

import { setPerformance } from './api/vscode/language/util';
import { ExtensionLogger2 } from './extension-log2';
import { ExtensionReporter } from './extension-reporter';

import '@opensumi/ide-i18n';

setPerformance(performance);

Error.stackTraceLimit = 100;
let logger: any = console;
let preload: IExtensionHostService;
async function initRPCProtocol(extInjector: Injector): Promise<any> {
  const extConnection = argv[KT_PROCESS_SOCK_OPTION_KEY];

  logger = new ExtensionLogger2(extInjector);
  logger.log('init rpc protocol for ext connection path', extConnection);

  const socket = net.createConnection(JSON.parse(extConnection));

  const appConfig: ExtHostAppConfig = extInjector.get(ExtHostAppConfig);

  const extProtocol = new SumiConnectionMultiplexer(new NetSocketConnection(socket), {
    timeout: appConfig.rpcMessageTimeout,
    io: createExtMessageIO(knownProtocols),
  });

  return { extProtocol, logger };
}

function patchProcess() {
  process.exit = function (code?: number) {
    const err = new Error(`An extension called process.exit(${code ?? ''}) and this was prevented.`);
    getWarnLogger()(err.stack);
  } as (code?: number) => never;

  // override Electron's process.crash() method
  process.crash = function () {
    const err = new Error('An extension called process.crash() and this was prevented.');
    getWarnLogger()(err.stack);
  };
}

function _wrapConsoleMethod(method: 'log' | 'info' | 'warn' | 'error') {
  // eslint-disable-next-line no-console
  const original = console[method].bind(console);

  Object.defineProperty(console, method, {
    set: () => {},
    get: () =>
      function (...args) {
        original(...args);
      },
  });
}

function patchConsole() {
  _wrapConsoleMethod('info');
  _wrapConsoleMethod('log');
  _wrapConsoleMethod('warn');
  _wrapConsoleMethod('error');
}

export async function extProcessInit(config: ExtProcessConfig = {}) {
  const extAppConfig = JSON.parse(argv[KT_APP_CONFIG_KEY] || '{}');
  const { injector, ...extConfig } = config;
  const extInjector = injector || new Injector();
  const reporterEmitter = new Emitter<ReporterProcessMessage>();
  extInjector.addProviders(
    {
      token: ExtHostAppConfig,
      useValue: { ...extAppConfig, ...extConfig },
    },
    {
      token: IReporter,
      useValue: new ExtensionReporter(reporterEmitter),
    },
  );
  if (locale) {
    setLanguageId(locale);
  }
  patchProcess();
  patchConsole();
  const { extProtocol: protocol, logger } = await initRPCProtocol(extInjector);
  try {
    let Preload = require('./ext.host');
    if (Preload.default) {
      Preload = Preload.default;
    }

    preload = new Preload(protocol, logger, extInjector);

    reporterEmitter.event((reportMessage: ReporterProcessMessage) => {
      if (process && process.send) {
        process.send({
          type: ProcessMessageType.REPORTER,
          data: reportMessage,
        });
      }
    });

    logger.log('preload.init start');
    await preload.init();
    logger.log('preload.init end');

    if (process && process.send) {
      process.send('ready');

      process.on('message', async (msg) => {
        if (msg === 'close') {
          logger.log('preload.close start');
          await preload.close();
          logger.log('preload.close end');
          if (process && process.send) {
            process.send('finish');
          }
        }
      });
    }
  } catch (e) {
    logger.error(e);
  }
}

function getErrorLogger() {
  // eslint-disable-next-line no-console
  return (logger && logger.error.bind(logger)) || console.error.bind(console);
}

function getWarnLogger() {
  // eslint-disable-next-line no-console
  return (logger && logger.warn.bind(logger)) || console.warn.bind(console);
}

function unexpectedErrorHandler(e) {
  setTimeout(() => {
    // 上报错误
    preload && preload.reportUnexpectedError(e);
    // 记录错误日志
    getErrorLogger()('[Extension-Host]', e.message, e.stack && '\n\n' + e.stack);
  }, 0);
}

function onUnexpectedError(e: any) {
  let err = e;
  if (!err) {
    getWarnLogger()(`Unknown Exception ${err}`);
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

suppressNodeJSEpipeError(process, (msg) => {
  getErrorLogger()(msg);
});

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
