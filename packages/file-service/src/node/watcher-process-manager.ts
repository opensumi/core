import { fork } from 'child_process';
import { Server, Socket, createServer } from 'net';

import { Autowired, Injectable } from '@opensumi/di';
import { IRPCProtocol } from '@opensumi/ide-connection';
import { BaseConnection } from '@opensumi/ide-connection/lib/common/connection/drivers/base';
import { NetSocketConnection } from '@opensumi/ide-connection/lib/common/connection/drivers/socket';
import { SumiConnectionMultiplexer } from '@opensumi/ide-connection/lib/common/rpc/multiplexer';
import { WSChannel } from '@opensumi/ide-connection/lib/common/ws-channel';
import { ILogServiceManager, SupportLogNamespace } from '@opensumi/ide-core-common/lib/log';
import { FileChange } from '@opensumi/ide-core-common/lib/types/file-watch';
import { normalizedIpcHandlerPathAsync } from '@opensumi/ide-core-common/lib/utils/ipc';
import { AppConfig, Deferred, ILogService, UriComponents } from '@opensumi/ide-core-node';

import { IWatcherHostService, KT_WATCHER_PROCESS_SOCK_KEY, WATCHER_INIT_DATA_KEY, WatcherProcessManagerProxy, WatcherServiceProxy } from '../common/watcher';

export const WatcherProcessManagerToken = Symbol('WatcherProcessManager');

@Injectable()
export class WatcherProcessManager {

  connection: BaseConnection<Uint8Array>;
  channel: WSChannel;
  protocol: IRPCProtocol;

  private logger: ILogService;

  private _whenReadyDeferred: Deferred<void> = new Deferred();

  @Autowired(ILogServiceManager)
  private readonly loggerManager: ILogServiceManager;

  @Autowired(AppConfig)
  private readonly appConfig: AppConfig;

  constructor() {
    this.logger = this.loggerManager.getLogger(SupportLogNamespace.Node);
  }

  $onDidFilesChanged(changes: FileChange[]) {
    console.log('notify watcher process: ', changes);
  }

  get whenReady() {
    return this._whenReadyDeferred.promise;
  }

  private clientWatcherConnectionServer: Map<string, Server> = new Map();

  private setProxyConnection(socket: Socket) {
    const protocol = new SumiConnectionMultiplexer(new NetSocketConnection(socket), {
      timeout: 1000,
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

  private async createWatcherProcess(clientId: string, ipcHandlerPath: string) {
    const forkArgs = [
      `--${KT_WATCHER_PROCESS_SOCK_KEY}=${JSON.stringify({
        path: ipcHandlerPath,
      })}`,
      `--${WATCHER_INIT_DATA_KEY}=${JSON.stringify({
        logDir: this.appConfig.logDir,
        logLevel: this.appConfig.logLevel,
        clientId,
      })}`,
    ];

    this.logger.log('Watcher process path: ', this.appConfig.watcherHost);
    const watcherProcess = fork(this.appConfig.watcherHost!, forkArgs, {
      silent: true,
    });

    this.logger.log('Watcher process fork success, pid: ', watcherProcess.pid);

    watcherProcess.on('exit', (code, signal) => {
      this.logger.log('watcher process exit: ', code, signal);
    });

    watcherProcess.on('message', (msg) => {
      //
    });
    return watcherProcess.pid;
  }

  async createProcess(clientId: string) {
    if (!this.appConfig.watcherHost) {
      this.logger.error('watcherHost is not set');
      return;
    }

    this.logger.log('create watcher prcess for client: ', clientId);
    this.logger.log('appconfig watcherHost: ', this.appConfig.watcherHost);

    const ipcHandlerPath = await this.getIPCHandlerPath('watcher_process');
    await this.createWatcherServer(clientId, ipcHandlerPath);

    const pid = await this.createWatcherProcess(clientId, ipcHandlerPath);

    return pid;
  }

  async disposeAllProcess() { }

  async watch(
    uri: UriComponents, options?: { excludes?: string[]; recursive?: boolean },
  ): Promise<number> {
    await this._whenReadyDeferred.promise;
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
