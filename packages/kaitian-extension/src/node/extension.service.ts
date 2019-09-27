import * as path from 'path';
import * as os from 'os';
import * as net from 'net';
import * as fs from 'fs-extra';
import { Injectable, Autowired } from '@ali/common-di';
import { ExtensionScanner } from './extension.scanner';
import { IExtensionMetaData, IExtensionNodeService, ExtraMetaData, IExtensionNodeClientService } from '../common';
import { getLogger, Deferred, isDevelopment, INodeLogger, AppConfig, isWindows } from '@ali/ide-core-node';
import * as cp from 'child_process';
import * as psTree from 'ps-tree';
import * as isRunning from 'is-running';

import {
  commonChannelPathHandler,

  SocketMessageReader,
  SocketMessageWriter,

  WebSocketMessageReader,
  WebSocketMessageWriter,
  WSChannel,
} from '@ali/ide-connection';
import { normalizedIpcHandlerPath } from '@ali/ide-core-common/lib/utils/ipc';

const MOCK_CLIENT_ID = 'MOCK_CLIENT_ID';

@Injectable()
export class ExtensionNodeServiceImpl implements IExtensionNodeService  {

  private instanceId = 'ExtensionNodeServiceImpl:' + new Date();
  static MaxExtProcesCount: number = 5;
  static ProcessCloseExitThreshold: number = 1000 * 5;

  @Autowired(INodeLogger)
  logger: INodeLogger;

  // 待废弃
  @Autowired(AppConfig)
  private appConfig: AppConfig;

  private extProcess: cp.ChildProcess;
  private extProcessClientId: string;

  private clientExtProcessMap: Map<string, cp.ChildProcess> = new Map();
  private clientExtProcessInitDeferredMap: Map<string, Deferred<void>> = new Map();
  private clientExtProcessExtConnection: Map<string, any> = new Map();
  private clientExtProcessExtConnectionServer: Map<string, net.Server> = new Map();
  private clientExtProcessFinishDeferredMap: Map<string, Deferred<void>> = new Map();
  private clientExtProcessThresholdExitTimerMap: Map<string, NodeJS.Timeout> = new Map();
  private clientServiceMap: Map<string, IExtensionNodeClientService> = new Map();

  // 待废弃
  private extServer: net.Server;
  private electronMainThreadServer: net.Server;
  private extConnection;
  private connectionDeffered: Deferred<void>;
  private initDeferred: Deferred<void>;
  private clientId;
  private clientProcessMap: Map<string, cp.ChildProcess>;

  private extensionScanner: ExtensionScanner;

  public setConnectionServiceClient(clientId: string, serviceClient: IExtensionNodeClientService) {
    this.clientServiceMap.set(clientId, serviceClient);
  }
  private extServerListenPaths: Map<string, string> = new Map();

  private electronMainThreadListenPaths: Map<string, string> = new Map();

  private pendingClientExtProcessDisposer: Promise<void> | null;

  public async getAllExtensions(scan: string[], extenionCandidate: string[], extraMetaData: {[key: string]: any}): Promise<IExtensionMetaData[]> {
    // 扫描内置插件和插件市场的插件目录
    this.extensionScanner = new ExtensionScanner([...scan, this.appConfig.marketplace.extensionDir], extenionCandidate, extraMetaData);
    return this.extensionScanner.run();
  }

  async getExtension(extensionPath: string, extraMetaData?: ExtraMetaData): Promise<IExtensionMetaData | undefined> {
    return await ExtensionScanner.getExtension(extensionPath, extraMetaData);
  }

  public getExtServerListenPath(clientId: string): string {
    if (!this.extServerListenPaths.has(clientId)) {
      this.extServerListenPaths.set(clientId, normalizedIpcHandlerPath(`ext_process`, true));
    }
    return this.extServerListenPaths.get(clientId)!;
  }
  public getElectronMainThreadListenPath(clientId: string): string {
    if (!this.electronMainThreadListenPaths.has(clientId)) {
      this.electronMainThreadListenPaths.set(clientId, normalizedIpcHandlerPath(`main_thread`, true));
    }
    return this.electronMainThreadListenPaths.get(clientId)!;
  }

  public getElectronMainThreadListenPath2(clientId: string): string {
    return this.getElectronMainThreadListenPath(clientId);
  }

  public async resolveConnection() {
    if ( this.connectionDeffered) {
      await this.connectionDeffered.promise;
    } else {
      getLogger().log(`not found connectionDeferred`);
    }

  }
  public async resolveProcessInit() {
    if (this.initDeferred) {
      await this.initDeferred.promise;
    } else {
      getLogger().log(`not found initDeferred`);
    }
  }

  public async setExtProcessConnectionForward() {
    console.log('setExtProcessConnectionForward', this.instanceId);
    const self = this;
    this._setMainThreadConnection((connectionResult) => {
      const {connection: mainThreadConnection, clientId} = connectionResult;
      if (
        !(
          this.clientExtProcessMap.has(clientId) && isRunning( (this.clientExtProcessMap.get(clientId) as cp.ChildProcess).pid ) && this.clientExtProcessExtConnection.has(clientId)
        )
      ) {

        console.log('this.clientExtProcessMap', self.clientExtProcessMap.keys());
        // 进程未调用启动直接连接
        this.logger.log(`${clientId} clientId process connection set error`, self.clientExtProcessMap.has(clientId), self.clientExtProcessMap.has(clientId) ?  isRunning( (this.clientExtProcessMap.get(clientId) as cp.ChildProcess).pid) : false, this.clientExtProcessExtConnection.has(clientId));
        this.infoProcessNotExist(clientId);

        return;
      }

      const extConnection = this.clientExtProcessExtConnection.get(clientId);
      // 重新生成实例，避免 tcp 消息有残留的缓存，造成分包错误
      const extConnectionReader = new SocketMessageReader(extConnection.connection);
      const extConnectionWriter = new SocketMessageWriter(extConnection.connection);

      this.clientExtProcessExtConnection.set(clientId, {
        reader: extConnectionReader,
        writer: extConnectionWriter,
        connection: extConnection.connection,
      });

      mainThreadConnection.reader.listen((input) => {
        extConnectionWriter.write(input);
      });

      extConnectionReader.listen((input) => {
        mainThreadConnection.writer.write(input);
      });

      if (this.clientExtProcessThresholdExitTimerMap.has(clientId)) {
        const timer = this.clientExtProcessThresholdExitTimerMap.get(clientId) as NodeJS.Timeout;
        clearTimeout(timer);
      }

      console.log(`setExtProcessConnectionForward clientId ${clientId}`);

    });

  }

  public async createProcess2(clientId: string) {
    console.log('createProcess2', this.instanceId);
    if (this.pendingClientExtProcessDisposer) {
      console.log('Waiting for disposer to complete.');
      await this.pendingClientExtProcessDisposer;
    }

    this.logger.log('createProcess2 clientId', clientId);

    const processClientIdArr = Array.from(this.clientExtProcessMap.keys());
    if (processClientIdArr.length >= ExtensionNodeServiceImpl.MaxExtProcesCount) {
      const killProcessClientId = processClientIdArr[0];
      await this.disposeClientExtProcess(killProcessClientId);
    }

    let preloadPath;
    const forkOptions: cp.ForkOptions =  {};
    const forkArgs: string[] = [];
    let extProcessPath: string = '';
    forkOptions.execArgv = [];

    if (process.env.KTELECTRON) {
      extProcessPath = process.env.EXTENSION_HOST_ENTRY as string;
      forkArgs.push(`--kt-process-sockpath=${this.getExtServerListenPath(clientId)}`);
    } else {
      preloadPath = process.env.EXT_MODE === 'js' ? path.join(__dirname, '../../lib/hosted/ext.host.js') : path.join(__dirname, '../hosted/ext.host' + path.extname(module.filename));
      // ts-node模式
      if (process.env.EXT_MODE !== 'js' && module.filename.endsWith('.ts')) {
        forkOptions.execArgv = forkOptions.execArgv.concat(['-r', 'ts-node/register', '-r', 'tsconfig-paths/register']);
      }

      forkArgs.push(`--kt-process-preload=${preloadPath}`);
      forkArgs.push(`--kt-process-sockpath=${this.getExtServerListenPath(clientId)}`);
      extProcessPath = (process.env.EXT_MODE === 'js' ? path.join(__dirname, '../../lib/hosted/ext.process.js') : path.join(__dirname, '../hosted/ext.process' + path.extname(module.filename)));
    }

    if (isDevelopment()) {
      forkOptions.execArgv.push('--inspect=9889');
    }

    console.log('extProcessPath', extProcessPath);

    console.time(`${clientId} fork ext process`);
    const extProcess = cp.fork(extProcessPath, forkArgs, forkOptions);
    this.logger.debug('extProcess.pid', extProcess.pid);

    extProcess.on('exit', async (code, signal) => {
      console.log('extProcess.pid exit', extProcess.pid, 'code', code, 'signal', signal);

      if (this.clientExtProcessMap.has(clientId)) {
        await this.disposeClientExtProcess(clientId, false, false);
        this.infoProcessCrash(clientId);
      } else {
        console.log('extProcess.pid exit by dispose', extProcess.pid);
      }
    });

    this.clientExtProcessMap.set(clientId, extProcess);

    console.log('createProcess2', this.clientExtProcessMap.keys());
    const extProcessInitDeferred = new Deferred<void>();
    this.clientExtProcessInitDeferredMap.set(clientId, extProcessInitDeferred);

    this._getExtHostConnection2(clientId);

    await new Promise((resolve) => {
      const initHandler = (msg) => {
        if (msg === 'ready') {
          console.timeEnd(`${clientId} fork ext process`);
          extProcessInitDeferred.resolve();
          this.clientExtProcessFinishDeferredMap.set(clientId, new Deferred<void>());
          resolve();
        } else if (msg === 'finish') {
          const finishDeferred = this.clientExtProcessFinishDeferredMap.get(clientId) as Deferred<void>;
          finishDeferred.resolve();
        }
      };
      extProcess.on('message', initHandler);
    });

  }

  private async _setMainThreadConnection(handler) {

    if (process.env.KTELECTRON) {
      const clientId = process.env.CODE_WINDOW_CLIENT_ID as string;
      const mainThreadServer: net.Server = net.createServer();
      this.electronMainThreadServer = mainThreadServer;
      const mainThreadListenPath = this.getElectronMainThreadListenPath2(clientId);
      console.log('mainThreadListenPath', mainThreadListenPath);

      try {
        if (!isWindows) {
          await fs.unlink(mainThreadListenPath);
        }
      } catch (e) {
        getLogger().error(e);
      }

      await new Promise((resolve) => {
        mainThreadServer.listen(mainThreadListenPath, () => {
          getLogger().log(`electron mainThread listen on ${mainThreadListenPath}`);
          resolve();
        });
      });

      mainThreadServer.on('connection', (connection) => {
        getLogger().log(`kaitian electron ext main connected ${clientId}`);

        handler({
          connection: {
            reader: new SocketMessageReader(connection),
            writer: new SocketMessageWriter(connection),
          },
          clientId,
        });

        connection.on('close', () => {
          this.disposeClientExtProcess(clientId);
        });

      });

    } else {
      commonChannelPathHandler.register('ExtMainThreadConnection', {
        handler: (connection: WSChannel, connectionClientId: string) => {
          getLogger().log(`kaitian ext main connected ${connectionClientId}`);

          const reader =  new WebSocketMessageReader(connection);
          const writer = new WebSocketMessageWriter(connection);
          handler({
            connection: {
              reader,
              writer,
            },
            clientId: connectionClientId,
          });

          connection.onClose(() => {
            reader.dispose();
            writer.dispose();
            console.log(`remove ext mainConnection ${connectionClientId} `);

            if (this.clientExtProcessExtConnection.has(connectionClientId)) {
              const extConnection: any = this.clientExtProcessExtConnection.get(connectionClientId);
              if (extConnection.writer) {
                extConnection.writer.dispose();
              }
              if ( extConnection.reader) {
                extConnection.reader.dispose();
              }

            }

            this.closeExtProcess(connectionClientId);
          });

        },
        dispose: (connection, connectionClientId) => {
          // FIXME: 暂时先不杀掉
          // this.disposeClientExtProcess(connectionClientId);
        },
      });
    }
  }

  private closeExtProcess(connectionClientId: string) {

    if (this.clientExtProcessMap.has(connectionClientId)) {
      const timer = setTimeout(() => {
        const disposer = this.disposeClientExtProcess(connectionClientId);
        if (isDevelopment()) {
          this.pendingClientExtProcessDisposer = disposer;
        }
      }, ExtensionNodeServiceImpl.ProcessCloseExitThreshold);

      this.clientExtProcessThresholdExitTimerMap.set(connectionClientId, timer);
    }
  }

  /**
   * 定制插件进程检查、清理任务
   */
  private clearCheckTask() {

  }
  private infoProcessNotExist(clientId: string) {
    if (this.clientServiceMap.has(clientId)) {
      (this.clientServiceMap.get(clientId) as IExtensionNodeClientService).infoProcessNotExist();
      this.clientServiceMap.delete(clientId);
    }
  }
  private infoProcessCrash(clientId: string) {
    if (this.clientServiceMap.has(clientId)) {
      (this.clientServiceMap.get(clientId) as IExtensionNodeClientService).infoProcessCrash();
    }
  }

  public async disposeClientExtProcess(clientId: string, info: boolean = true, killProcess: boolean = true) {

    if (this.clientExtProcessMap.has(clientId)) {
      const extProcess = this.clientExtProcessMap.get(clientId) as cp.ChildProcess;
      if (isRunning(extProcess.pid)) {
        extProcess.send('close');
        // deactive
        // subscription
        if (this.clientExtProcessFinishDeferredMap.has(clientId)) {
          await (this.clientExtProcessFinishDeferredMap.get(clientId) as Deferred<void>).promise;
        }
      }

      // extServer 关闭
      if (this.clientExtProcessExtConnectionServer.has(clientId)) {
        await (this.clientExtProcessExtConnectionServer.get(clientId) as net.Server).close();
      }

      await new Promise((resolve) => {

        psTree(extProcess.pid, (err: Error, childProcesses) => {
          childProcesses.forEach((p: psTree.PS) => {
            console.log('psTree child process', p.PID);
            try {
                const pid = parseInt(p.PID, 10);
                if (isRunning(pid)) {
                  process.kill(pid);
                }
              } catch (e) {
                console.error(e);
              }
          });
          resolve();
        });
      });

      this.clientExtProcessExtConnection.delete(clientId);
      this.clientExtProcessExtConnectionServer.delete(clientId);
      this.clientExtProcessFinishDeferredMap.delete(clientId);
      this.clientExtProcessInitDeferredMap.delete(clientId);
      this.clientExtProcessThresholdExitTimerMap.delete(clientId);
      this.clientExtProcessMap.delete(clientId);

      // kill
      if (killProcess) {
        extProcess.kill();
      }

      if (info) {
        this.infoProcessNotExist(clientId);
      }
      this.logger.log(`${clientId} extProcess dispose`);

      this.pendingClientExtProcessDisposer = null;

    }
  }
  // 待废弃
  private async _getMainThreadConnection(clientId: string) {
    if (process.env.KTELECTRON) {
      const server: net.Server = net.createServer();
      this.electronMainThreadServer = server;
      const listenPath = this.getElectronMainThreadListenPath(clientId);
      try {
        if (!isWindows) {
          await fs.unlink(listenPath);
        }
      } catch (e) {
        getLogger().error(e);
      }

      await new Promise((resolve) => {
        server.listen(listenPath, () => {
          getLogger().log(`electron mainThread listen on ${listenPath}`);
          resolve();
        });
      });

      return new Promise((resolve) => {

        const connectionHandler = (connection) => {
          getLogger().log('electron ext main connected');

          resolve({
            reader: new SocketMessageReader(connection),
            writer: new SocketMessageWriter(connection),
          });

          connection.on('close', () => {
            getLogger().log('remove electron ext main');
            server.removeListener('connection', connectionHandler);
            this._disposeConnection(clientId);
          });
        };

        server.on('connection', connectionHandler);
      });

    } else {
      return new Promise((resolve) => {
        const channelHandler = {
          handler: (connection, connectionClientId: string) => {
            getLogger().log('kaitian ext main connected');

            resolve({
              reader: new WebSocketMessageReader(connection),
              writer: new WebSocketMessageWriter(connection),
            });
          },
          dispose: () => {
            getLogger().log('remove _getMainThreadConnection handler');
            // Dispose 连接操作
            this._disposeConnection(clientId);
            commonChannelPathHandler.removeHandler(clientId, channelHandler);
          },
        };

        commonChannelPathHandler.register(clientId, channelHandler);
      });
    }
  }
  // 待废弃
  private async _disposeConnection(clientId: string) {
    if (this.extProcess) {
      this.extProcess.kill(); // TODO: cache 保存
      getLogger().log(`kaitian ext ${clientId} connected killed`);
    }

    if (this.extServer) {
      this.extServer.close();
    }

    if (this.electronMainThreadServer) {
      this.electronMainThreadServer.close();
    }

  }
  // 待废弃
  private async _getExtHostConnection(clientId: string) {
    const extServerListenPath = this.getExtServerListenPath(clientId);
    // TODO: 先使用单个 server，再尝试单个 server 与多个进程进行连接
    const extServer = net.createServer();

    try {
      if (!isWindows) {
        await fs.unlink(extServerListenPath);
      }
    } catch (e) {}

    const extConnection =  await new Promise((resolve) => {
      extServer.on('connection', (connection) => {
        console.log('kaitian ext host connected');

        const connectionObj = {
          reader: new SocketMessageReader(connection),
          writer: new SocketMessageWriter(connection),
        };
        this.extConnection = connectionObj;
        resolve(connectionObj);
      });
      extServer.listen(extServerListenPath, () => {
        getLogger().log(`kaitian ext server listen on ${extServerListenPath}`);
      });
      this.extServer = extServer;

      // this.processServerMap.set(name, extServer);
    });

    return extConnection;
  }

  private async _getExtHostConnection2(clientId: string) {
    const extServerListenPath = this.getExtServerListenPath(clientId);
    // TODO: 先使用单个 server，再尝试单个 server 与多个进程进行连接
    const extServer = net.createServer();
    this.clientExtProcessExtConnectionServer.set(clientId, extServer);

    try {
      if (!isWindows) {
        await fs.unlink(extServerListenPath);
      }
    } catch (e) { }

    const extConnection =  await new Promise((resolve) => {
      extServer.on('connection', (connection) => {
        getLogger().log('kaitian _getExtHostConnection2 ext host connected');

        const connectionObj = {
          // reader: new SocketMessageReader(connection),
          // writer: new SocketMessageWriter(connection),
          connection,
        };
        resolve(connectionObj);
      });
      extServer.listen(extServerListenPath, () => {
        getLogger().log(`${clientId} kaitian ext server listen on ${extServerListenPath}`);
      });
    });

    this.clientExtProcessExtConnection.set(clientId, extConnection);
    return extConnection;
  }
}
