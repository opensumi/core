import net from 'net';
import { performance } from 'perf_hooks';
import Stream from 'stream';

import { ConstructorOf, Injector } from '@opensumi/di';
import { RPCProtocol, initRPCService, RPCServiceCenter } from '@opensumi/ide-connection';
import { createSocketConnection } from '@opensumi/ide-connection/lib/node';
import {
  Emitter,
  ReporterProcessMessage,
  LogLevel,
  IReporter,
  setLanguageId,
  ILogService,
  isPromiseCanceledError,
  locale,
} from '@opensumi/ide-core-common';
import { argv } from '@opensumi/ide-core-common/lib/node/cli';
import { AppConfig } from '@opensumi/ide-core-node/lib/types';

import { ProcessMessageType, IExtensionHostService, KT_PROCESS_SOCK_OPTION_KEY, KT_APP_CONFIG_KEY } from '../common';
import { CommandHandler } from '../common/vscode';

import { setPerformance } from './api/vscode/language/util';
import { ExtensionLogger2 } from './extension-log2';
import { ExtensionReporter } from './extension-reporter';

import '@opensumi/ide-i18n';

setPerformance(performance);

Error.stackTraceLimit = 100;
let logger: any = console;
let preload: IExtensionHostService;
export interface IBuiltInCommand {
  id: string;
  handler: CommandHandler;
}

export interface CustomChildProcess {
  stdin: Stream.Writable;
  stdout: Stream.Readable;
  kill: () => void;
}

export interface CustomChildProcessModule {
  spawn(command: string, args: string | string[], options: any): CustomChildProcess;
}

export interface ExtHostAppConfig extends Partial<AppConfig> {
  builtinCommands?: IBuiltInCommand[];
  customDebugChildProcess?: CustomChildProcessModule;
  /**
   * 集成方自定义 vscode.version 版本
   * 设置该参数可能会导致插件运行异常
   * @type {string} 插件版本号
   * @memberof ExtHostAppConfig
   */
  customVSCodeEngineVersion?: string;
}

export interface ExtProcessConfig {
  injector?: Injector;
  LogServiceClass?: ConstructorOf<ILogService>;
  logDir?: string;
  logLevel?: LogLevel;
  /**
   * 这种 command 只有插件能调用到，且只能在插件进程调用到
   */
  builtinCommands?: IBuiltInCommand[];
  customDebugChildProcess?: CustomChildProcessModule;
  customVSCodeEngineVersion?: string;
  /**
   * control rpcProtocol message timeout
   * default -1，it means disable
   */
  rpcMessageTimeout?: number;
}

async function initRPCProtocol(extInjector: Injector): Promise<any> {
  const extCenter = new RPCServiceCenter();
  const { getRPCService } = initRPCService<{
    onMessage(msg: string): void;
  }>(extCenter);

  const extConnection = net.createConnection(JSON.parse(argv[KT_PROCESS_SOCK_OPTION_KEY] || '{}'));

  extCenter.setConnection(createSocketConnection(extConnection));

  const service = getRPCService('ExtProtocol');

  const onMessageEmitter = new Emitter<string>();
  service.on('onMessage', (msg: string) => {
    onMessageEmitter.fire(msg);
  });

  const onMessage = onMessageEmitter.event;
  const send = service.onMessage;

  const appConfig = extInjector.get(AppConfig);

  const extProtocol = new RPCProtocol({
    onMessage,
    send,
    timeout: appConfig.rpcMessageTimeout,
  });

  logger = new ExtensionLogger2(extInjector);
  logger.log('process extConnection path', argv[KT_PROCESS_SOCK_OPTION_KEY]);
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
      token: AppConfig,
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

    logger?.log('preload.init start');
    await preload.init();
    logger?.log('preload.init end');

    if (process && process.send) {
      process.send('ready');

      process.on('message', async (msg) => {
        if (msg === 'close') {
          logger?.log('preload.close start');
          await preload.close();
          logger?.log('preload.close end');
          if (process && process.send) {
            process.send('finish');
          }
        }
      });
    }
  } catch (e) {
    logger?.error(e);
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
