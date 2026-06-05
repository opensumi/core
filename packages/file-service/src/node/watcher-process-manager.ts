import { ChildProcess, fork } from 'child_process';
import { existsSync } from 'fs';
import { Server, Socket, createServer } from 'net';
import path from 'path';

import { Autowired, Injectable } from '@opensumi/di';
import { NetSocketConnection } from '@opensumi/ide-connection/lib/common/connection/drivers/socket';
import { SumiConnectionMultiplexer } from '@opensumi/ide-connection/lib/common/rpc/multiplexer';
import { ILogServiceManager, SupportLogNamespace } from '@opensumi/ide-core-common/lib/log';
import {
  DidFilesChangedParams,
  FileSystemWatcherClient,
  FileWatcherFailureParams,
  FileWatcherOverflowParams,
  RecursiveWatcherBackend,
} from '@opensumi/ide-core-common/lib/types/file-watch';
import { normalizedIpcHandlerPathAsync } from '@opensumi/ide-core-common/lib/utils/ipc';
import { AppConfig, Deferred, ILogService, UriComponents } from '@opensumi/ide-core-node';
import { process as processUtil } from '@opensumi/ide-utils';

import {
  IWatcherHostService,
  IWatcherProcessManager,
  SUMI_WATCHER_PROCESS_SOCK_KEY,
  WATCHER_INIT_DATA_KEY,
  WatcherProcessManagerProxy,
  WatcherServiceProxy,
} from '../common/watcher';

export const WatcherProcessManagerToken = Symbol('WatcherProcessManager');

@Injectable({ multiple: true })
export class WatcherProcessManagerImpl implements IWatcherProcessManager {
  private protocol?: SumiConnectionMultiplexer;

  private watcherProcess?: ChildProcess;

  private watcherProcessReady = false;

  private logger: ILogService;

  private _whenReadyDeferred: Deferred<void> = new Deferred();

  @Autowired(ILogServiceManager)
  private readonly loggerManager: ILogServiceManager;

  @Autowired(AppConfig)
  private readonly appConfig: AppConfig;

  private watcherClient: FileSystemWatcherClient;

  constructor() {
    this.logger = this.loggerManager.getLogger(SupportLogNamespace.Node);
  }

  setClient(client: FileSystemWatcherClient) {
    if (!this.watcherClient) {
      this.watcherClient = client;
    }
  }

  $onDidFilesChanged(changes: DidFilesChangedParams) {
    this.watcherClient.onDidFilesChanged(changes);
  }

  $onWatcherOverflow(event: FileWatcherOverflowParams) {
    this.watcherClient.onWatcherOverflow?.(event);
  }

  $onWatcherFailed(event: FileWatcherFailureParams) {
    this.watcherClient.onWatcherFailed?.(event);
  }

  get whenReady() {
    return this._whenReadyDeferred.promise;
  }

  private clientWatcherConnectionServer: Map<string, Server> = new Map();

  private setProxyConnection(socket: Socket) {
    const protocol = new SumiConnectionMultiplexer(new NetSocketConnection(socket), {
      timeout: -1,
    });
    protocol.set(WatcherProcessManagerProxy, this);

    this.protocol = protocol;
    socket.on('close', () => {
      protocol.dispose();
    });

    this._whenReadyDeferred.resolve();
    this.watcherProcessReady = true;
  }

  private getProxy() {
    if (!this.protocol) {
      throw new Error('Watcher process is not connected.');
    }
    return this.protocol.getProxy<IWatcherHostService>(WatcherServiceProxy);
  }

  private async getIPCHandlerPath(name: string) {
    return await normalizedIpcHandlerPathAsync(name, true, this.appConfig.extHostIPCSockPath);
  }

  private async createWatcherServer(clientId: string, ipcHandlerPath: string) {
    const listenOptions = {
      path: ipcHandlerPath,
    };

    const server = createServer();
    this.clientWatcherConnectionServer.set(clientId, server);

    server.on('connection', (socket) => {
      this.logger.log('watcher process connected');
      this.setProxyConnection(socket);
    });

    await new Promise<void>((resolve, reject) => {
      const onError = (error: Error) => {
        reject(error);
      };

      server.once('error', onError);
      server.listen(listenOptions, () => {
        server.off('error', onError);
        this.logger.log(`watcher process listen on ${JSON.stringify(listenOptions)}`);
        resolve();
      });
    });
  }

  get watcherHost() {
    return (
      this.appConfig.watcherHost ||
      (process.env.EXT_MODE === 'js'
        ? path.join(__dirname, '../../lib/node/hosted/watcher.process.js')
        : path.join(__dirname, 'hosted', 'watcher.process.' + processUtil.extFileType))
    );
  }

  private assertWatcherHost(watcherHost: string) {
    if (existsSync(watcherHost)) {
      return;
    }

    const message = `Watcher process entry not found: ${watcherHost}. Please run "yarn build:watcher-host" before starting with EXT_MODE=js, or set WATCHER_HOST_ENTRY to a valid watcher host.`;
    this.logger.error(message);
    throw new Error(message);
  }

  private resetWhenReadyDeferred(reason?: Error) {
    this._whenReadyDeferred.promise.catch(() => undefined);

    if (reason) {
      this._whenReadyDeferred.reject(reason);
    }

    this._whenReadyDeferred = new Deferred();
    this._whenReadyDeferred.promise.catch(() => undefined);
    this.watcherProcessReady = false;
  }

  private disposeWatcherProcess() {
    const watcherProcess = this.watcherProcess;
    if (!watcherProcess) {
      return;
    }

    this.watcherProcess = undefined;
    this.protocol?.dispose();
    this.protocol = undefined;

    if (!watcherProcess.killed && watcherProcess.exitCode === null && watcherProcess.signalCode === null) {
      watcherProcess.kill();
    }
  }

  private bindWatcherProcessOutput(watcherProcess: ChildProcess) {
    watcherProcess.stdout?.on('data', (chunk) => {
      const message = chunk.toString().trim();
      if (message) {
        this.logger.log('[WatcherProcess stdout]', message);
      }
    });

    watcherProcess.stderr?.on('data', (chunk) => {
      const message = chunk.toString().trim();
      if (message) {
        this.logger.error('[WatcherProcess stderr]', message);
      }
    });
  }

  private async createWatcherProcess(
    clientId: string,
    ipcHandlerPath: string,
    watcherHost: string,
    backend?: RecursiveWatcherBackend,
  ) {
    const forkArgs = [
      `--${SUMI_WATCHER_PROCESS_SOCK_KEY}=${JSON.stringify({
        path: ipcHandlerPath,
      })}`,
      `--${WATCHER_INIT_DATA_KEY}=${JSON.stringify({
        logDir: this.appConfig.logDir,
        logLevel: this.appConfig.logLevel,
        backend,
        clientId,
      })}`,
    ];

    this.logger.log('Watcher process path: ', watcherHost);
    this.watcherProcess = fork(watcherHost, forkArgs, {
      silent: true,
    });
    const watcherProcess = this.watcherProcess;
    this.bindWatcherProcessOutput(watcherProcess);

    this.logger.log('Watcher process fork success, pid: ', watcherProcess.pid);

    watcherProcess.on('error', (error) => {
      this.logger.error('watcher process error: ', error);
    });

    watcherProcess.on('exit', async (code, signal) => {
      this.logger.warn('watcher process exit: ', code, signal);
      if (this.watcherProcess === watcherProcess) {
        this.watcherProcess = undefined;
        this.protocol?.dispose();
        this.protocol = undefined;

        if (!this.watcherProcessReady) {
          this._whenReadyDeferred.reject(
            new Error(`Watcher process exited before ready, code: ${code}, signal: ${signal}`),
          );
        }
      }
    });

    return watcherProcess.pid;
  }

  async createProcess(clientId: string, backend?: RecursiveWatcherBackend) {
    const watcherHost = this.watcherHost;
    this.resetWhenReadyDeferred(new Error('Watcher process is restarting.'));

    try {
      this.assertWatcherHost(watcherHost);
      this.logger.log('create watcher process for client: ', clientId);
      this.logger.log('appconfig watcherHost: ', watcherHost);

      const ipcHandlerPath = await this.getIPCHandlerPath('watcher_process');
      // 如果存在连接，则关闭连接, 避免重复创建
      const server = this.clientWatcherConnectionServer.get(clientId);
      if (server) {
        // 等待真正关闭后再移除引用，避免句柄和端口泄漏
        await new Promise<void>((res) => server.close(() => res()));
        this.clientWatcherConnectionServer.delete(clientId);
      }
      this.disposeWatcherProcess();
      await this.createWatcherServer(clientId, ipcHandlerPath);

      const pid = await this.createWatcherProcess(clientId, ipcHandlerPath, watcherHost, backend);

      return pid;
    } catch (error) {
      this._whenReadyDeferred.reject(error);
      throw error;
    }
  }

  async dispose() {
    try {
      await this._whenReadyDeferred.promise;
      await this.getProxy().$dispose();
    } catch {
    } finally {
      this.disposeWatcherProcess();
    }
  }

  async watch(
    uri: UriComponents,
    options?: { excludes?: string[]; recursive?: boolean; pollingWatch?: boolean },
  ): Promise<number> {
    this.logger.log('Wait for watcher process ready...');
    await this._whenReadyDeferred.promise;
    this.logger.log('start watch: ', uri);
    return this.getProxy().$watch(uri, options);
  }

  async unWatch(watcheId) {
    await this._whenReadyDeferred.promise;
    return this.getProxy().$unwatch(watcheId);
  }

  async setWatcherFileExcludes(excludes: string[]) {
    await this._whenReadyDeferred.promise;
    return this.getProxy().$setWatcherFileExcludes(excludes);
  }
}
