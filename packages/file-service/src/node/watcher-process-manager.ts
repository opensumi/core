import { ChildProcess, fork } from 'child_process';
import { Server, Socket, createServer } from 'net';
import path from 'path';

import { Autowired, Injectable } from '@opensumi/di';
import { IRPCProtocol } from '@opensumi/ide-connection';
import { NetSocketConnection } from '@opensumi/ide-connection/lib/common/connection/drivers/socket';
import { SumiConnectionMultiplexer } from '@opensumi/ide-connection/lib/common/rpc/multiplexer';
import { ILogServiceManager, SupportLogNamespace } from '@opensumi/ide-core-common/lib/log';
import {
  DidFilesChangedParams,
  FileSystemWatcherClient,
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
  private protocol: IRPCProtocol;

  private watcherProcess?: ChildProcess;

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
  }

  private getProxy() {
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

    server.listen(listenOptions, () => {
      this.logger.log(`watcher process listen on ${JSON.stringify(listenOptions)}`);
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

  private async createWatcherProcess(clientId: string, ipcHandlerPath: string, backend?: RecursiveWatcherBackend) {
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

    this.logger.log('Watcher process path: ', this.watcherHost);
    this.watcherProcess = fork(this.watcherHost, forkArgs, {
      silent: true,
    });

    this.logger.log('Watcher process fork success, pid: ', this.watcherProcess.pid);

    this.watcherProcess.on('exit', async (code, signal) => {
      this.logger.warn('watcher process exit: ', code, signal);
    });

    return this.watcherProcess.pid;
  }

  async createProcess(clientId: string, backend?: RecursiveWatcherBackend) {
    this.logger.log('create watcher process for client: ', clientId);
    this.logger.log('appconfig watcherHost: ', this.watcherHost);

    const ipcHandlerPath = await this.getIPCHandlerPath('watcher_process');
    await this.createWatcherServer(clientId, ipcHandlerPath);

    const pid = await this.createWatcherProcess(clientId, ipcHandlerPath, backend);

    return pid;
  }

  async dispose() {
    try {
      await this._whenReadyDeferred.promise;
      await this.getProxy().$dispose();
    } catch {
    } finally {
      this.watcherProcess?.kill();
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
