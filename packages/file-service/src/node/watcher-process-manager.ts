import { fork } from 'child_process';
import { createServer, Server } from 'net';
import { Autowired, Injectable } from '@opensumi/di';
import { ILogServiceManager, SupportLogNamespace } from '@opensumi/ide-core-common/lib/log';
import { AppConfig, ILogService, UriComponents } from '@opensumi/ide-core-node';
import { normalizedIpcHandlerPathAsync } from '@opensumi/ide-core-common/lib/utils/ipc';
import { KT_WATCHER_PROCESS_SOCK_KEY } from '../common/watcher';

export const WatcherProcessManagerToken = Symbol('WatcherProcessManager');

@Injectable()
export class WatcherProcessManager {
  private logger: ILogService;

  @Autowired(ILogServiceManager)
  private readonly loggerManager: ILogServiceManager;

  @Autowired(AppConfig)
  private readonly appConfig: AppConfig;

  constructor() {
    this.logger = this.loggerManager.getLogger(SupportLogNamespace.Node);
  }

  private clientWatcherConnectionServer: Map<string, Server> = new Map();

  private async getIPCHandlerPath(name: string) {
    return await normalizedIpcHandlerPathAsync(name, true, this.appConfig.extHostIPCSockPath);
  }

  private async createWatcherServer(clientId: string) {
    const listenOptions = {
      path: await this.getIPCHandlerPath('watcher_process'),
    };

    const server = createServer();
    this.clientWatcherConnectionServer.set(clientId, server);

    server.on('connection', (socket) => {
      this.logger.log('watcher process connected');
    });

    server.listen(listenOptions, () => {
      this.logger.log(`watcher process listen on ${JSON.stringify(listenOptions)}`);
    });
  }

  private async createWatcherProcess(clientId: string) {
    const ipcHandlerPath = await this.getIPCHandlerPath('watcher_process');

    const forkArgs = [
      `--${KT_WATCHER_PROCESS_SOCK_KEY}=${JSON.stringify({
        path: ipcHandlerPath,
        logDir: this.appConfig.logDir,
        logLevel: this.appConfig.logLevel,
        clientId,
      })}`,
    ];

    this.logger.log('Watcher process path: ', this.appConfig.watcherHost);
    const process = fork(this.appConfig.watcherHost!, forkArgs, {
      silent: true,
    });
    this.logger.log('Watcher process fork success, pid: ', process.pid);

    process.on('exit', (code, signal) => {
      console.log('watcher process exit: ', code, signal);
    });

    process.on('message', (msg) => {
      //
    });
    return process.pid;
  }

  async createProcess(clientId: string) {
    if (!this.appConfig.watcherHost) {
      this.logger.error('watcherHost is not set');
      return;
    }

    this.logger.log('create watcher prcess for client: ', clientId);
    this.logger.log('appconfig watcherHost: ', this.appConfig.watcherHost);
    await this.createWatcherServer(clientId);
    const pid = await this.createWatcherProcess(clientId);
    return pid;
  }

  async disposeAllProcess() { }

  async watch(
    uri: UriComponents, options?: { excludes?: string[]; recursive?: boolean },
  ): Promise<void> {
    // start watch
  }

  unWatch() {

  }

  setWatcherFileExcludes(excludes: string[]) {

  }
}
