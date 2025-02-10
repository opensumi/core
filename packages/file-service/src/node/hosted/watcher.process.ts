import { createConnection } from 'net';

import { Injector } from '@opensumi/di';
import { SumiConnectionMultiplexer } from '@opensumi/ide-connection';
import { NetSocketConnection } from '@opensumi/ide-connection/lib/common/connection/drivers';
import { argv } from '@opensumi/ide-core-common/lib/node/cli';
import { suppressNodeJSEpipeError } from '@opensumi/ide-core-common/lib/node/utils';
import { CommonProcessReporter, IReporter, ReporterProcessMessage } from '@opensumi/ide-core-common/lib/types';
import { Emitter, isPromiseCanceledError } from '@opensumi/ide-utils';

import { SUMI_WATCHER_PROCESS_SOCK_KEY, WATCHER_INIT_DATA_KEY } from '../../common/watcher';

import { WatcherProcessLogger } from './watch-process-log';
import { WatcherHostServiceImpl } from './watcher.host.service';

Error.stackTraceLimit = 100;
const logger: any = console;

async function initWatcherProcess() {
  patchConsole();
  patchProcess();
  const watcherInjector = new Injector();
  const reporterEmitter = new Emitter<ReporterProcessMessage>();

  watcherInjector.addProviders({
    token: IReporter,
    useValue: new CommonProcessReporter(reporterEmitter),
  });

  const initData = JSON.parse(argv[WATCHER_INIT_DATA_KEY]);
  const connection = JSON.parse(argv[SUMI_WATCHER_PROCESS_SOCK_KEY]);

  const socket = createConnection(connection);

  const watcherProtocol = new SumiConnectionMultiplexer(new NetSocketConnection(socket), {
    timeout: -1,
  });

  const logger = new WatcherProcessLogger(watcherInjector, initData.logDir, initData.logLevel);
  const watcherHostService = new WatcherHostServiceImpl(watcherProtocol, logger, initData.backend);
  watcherHostService.initWatcherServer();
}

(async () => {
  await initWatcherProcess();
})();

function getErrorLogger() {
  // eslint-disable-next-line no-console
  return (logger && logger.error.bind(logger)) || console.error.bind(console);
}

function getWarnLogger() {
  // eslint-disable-next-line no-console
  return (logger && logger.warn.bind(logger)) || console.warn.bind(console);
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

function unexpectedErrorHandler(e) {
  setTimeout(() => {
    getErrorLogger()('[Watcehr-Host]', e.message, e.stack && '\n\n' + e.stack);
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
