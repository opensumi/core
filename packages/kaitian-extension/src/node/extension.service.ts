import * as path from 'path';
import * as net from 'net';
import * as fs from 'fs-extra';
import { Injectable, Autowired } from '@ali/common-di';
import { ExtensionScanner } from './extension.scanner';
import { IExtensionMetaData, IExtensionNodeService, ExtraMetaData, IExtensionNodeClientService, ProcessMessageType } from '../common';
import { Deferred, isDevelopment, INodeLogger, AppConfig, isWindows, isElectronNode, ReporterProcessMessage, IReporter, IReporterService, REPORT_TYPE, PerformanceData, REPORT_NAME } from '@ali/ide-core-node';
import * as shellPath from 'shell-path';
import * as cp from 'child_process';
import * as isRunning from 'is-running';
import treeKill = require('tree-kill');

import {
  commonChannelPathHandler,

  SocketMessageReader,
  SocketMessageWriter,

  WebSocketMessageReader,
  WebSocketMessageWriter,
  WSChannel,
} from '@ali/ide-connection';
import { normalizedIpcHandlerPath } from '@ali/ide-core-common/lib/utils/ipc';

@Injectable()
export class ExtensionNodeServiceImpl implements IExtensionNodeService {

  private instanceId = 'ExtensionNodeServiceImpl:' + new Date();
  static MaxExtProcessCount: number = 5;
  static ProcessCloseExitThreshold: number = 1000 * 5;

  @Autowired(INodeLogger)
  logger: INodeLogger;

  @Autowired(AppConfig)
  private appConfig: AppConfig;

  @Autowired(IReporterService)
  reporterService: IReporterService;

  @Autowired(IReporter)
  reporter: IReporter;

  private extProcess: cp.ChildProcess;

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
  private connectionDeffered: Deferred<void>;
  private initDeferred: Deferred<void>;

  private extensionScanner: ExtensionScanner;

  public setConnectionServiceClient(clientId: string, serviceClient: IExtensionNodeClientService) {
    this.clientServiceMap.set(clientId, serviceClient);
  }
  private extServerListenPaths: Map<string, string> = new Map();

  private electronMainThreadListenPaths: Map<string, string> = new Map();

  private pendingClientExtProcessDisposer: Promise<void> | null;

  public async getAllExtensions(scan: string[], extensionCandidate: string[], localization: string, extraMetaData: { [key: string]: any } = {}): Promise<IExtensionMetaData[]> {
    // 扫描内置插件和插件市场的插件目录
    this.extensionScanner = new ExtensionScanner([...scan, this.appConfig.marketplace.extensionDir], localization, extensionCandidate, extraMetaData);
    return this.extensionScanner.run();
  }

  async getExtension(extensionPath: string, localization: string, extraMetaData?: ExtraMetaData): Promise<IExtensionMetaData | undefined> {
    return await ExtensionScanner.getExtension(extensionPath, localization, extraMetaData);
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
    if (this.connectionDeffered) {
      await this.connectionDeffered.promise;
    } else {
      this.logger.log(`not found connectionDeferred`);
    }

  }
  public async resolveProcessInit() {
    if (this.initDeferred) {
      await this.initDeferred.promise;
    } else {
      this.logger.log(`not found initDeferred`);
    }
  }

  public async setExtProcessConnectionForward() {
    this.logger.log('setExtProcessConnectionForward', this.instanceId);
    const self = this;
    this._setMainThreadConnection((connectionResult) => {
      const { connection: mainThreadConnection, clientId } = connectionResult;
      if (
        !(
          this.clientExtProcessMap.has(clientId) && isRunning((this.clientExtProcessMap.get(clientId) as cp.ChildProcess).pid) && this.clientExtProcessExtConnection.has(clientId)
        )
      ) {

        // 进程未调用启动直接连接
        this.logger.log(`${clientId} clientId process connection set error`, self.clientExtProcessMap.has(clientId), self.clientExtProcessMap.has(clientId) ? isRunning((this.clientExtProcessMap.get(clientId) as cp.ChildProcess).pid) : false, this.clientExtProcessExtConnection.has(clientId));
        this.infoProcessNotExist(clientId);
        this.reporterService.point(REPORT_NAME.EXTENSION_NOT_EXIST, clientId);
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

      this.logger.log(`setExtProcessConnectionForward clientId ${clientId}`);

    });

  }

  public async createProcess2(clientId: string) {
    this.logger.log('createProcess2', this.instanceId);
    this.logger.log('appconfig exthost', this.appConfig.extHost);
    if (this.pendingClientExtProcessDisposer) {
      this.logger.log('Waiting for disposer to complete.');
      await this.pendingClientExtProcessDisposer;
    }

    this.logger.log('createProcess2 clientId', clientId);

    const processClientIdArr = Array.from(this.clientExtProcessMap.keys());
    const maxExtProcessCount = this.appConfig.maxExtProcessCount || ExtensionNodeServiceImpl.MaxExtProcessCount;
    if (processClientIdArr.length >= maxExtProcessCount) {
      const killProcessClientId = processClientIdArr[0];
      await this.disposeClientExtProcess(killProcessClientId);
      this.logger.error(`Process count is over limit, max count is ${maxExtProcessCount}`);
    }

    let preloadPath;
    let forkOptions: cp.ForkOptions;
    // TODO: 软链模式下的路径兼容性存在问题
    if (isElectronNode()) {
      forkOptions = {
        env: {
          ...process.env,
          PATH: await shellPath(),
         },
      };
    } else {
      forkOptions = {
        env: {
          ...process.env,
         },
      };
    }
    const forkArgs: string[] = [];
    let extProcessPath: string = '';
    forkOptions.execArgv = [];

    if (process.env.KTELECTRON) {
      extProcessPath = this.appConfig.extHost || process.env.EXTENSION_HOST_ENTRY as string;
      forkArgs.push(`--kt-process-sockpath=${this.getExtServerListenPath(clientId)}`);
    } else {
      preloadPath = process.env.EXT_MODE === 'js' ? path.join(__dirname, '../../lib/hosted/ext.host.js') : path.join(__dirname, '../hosted/ext.host' + path.extname(module.filename));
      // ts-node模式
      if (process.env.EXT_MODE !== 'js' && module.filename.endsWith('.ts')) {
        forkOptions.execArgv = forkOptions.execArgv.concat(['-r', 'ts-node/register', '-r', 'tsconfig-paths/register']);
      }

      forkArgs.push(`--kt-process-preload=${preloadPath}`);
      forkArgs.push(`--kt-process-sockpath=${this.getExtServerListenPath(clientId)}`);
      if (this.appConfig.extHost) {
        this.logger.log(`extension host path ${this.appConfig.extHost}`);
        extProcessPath = this.appConfig.extHost;
      } else {
        extProcessPath = (process.env.EXT_MODE === 'js' ? path.join(__dirname, '../../lib/hosted/ext.process.js') : path.join(__dirname, '../hosted/ext.process' + path.extname(module.filename)));
      }
    }

    // 注意只能传递可以序列化的数据
    forkArgs.push(`--kt-app-config=${JSON.stringify({
      logDir: this.appConfig.logDir,
      logLevel: this.appConfig.logLevel,
      extLogServiceClassPath: this.appConfig.extLogServiceClassPath,
    })}`);

    if (isDevelopment()) {
      forkOptions.execArgv.push('--inspect=9889');
    }

    const forkTimer = this.reporterService.time(`${clientId} fork ext process`);
    const extProcess = cp.fork(extProcessPath, forkArgs, forkOptions);

    if (this.appConfig.onDidCreateExtensionHostProcess) {
      this.appConfig.onDidCreateExtensionHostProcess(extProcess);
    }
    this.logger.log('extProcess.pid', extProcess.pid);

    extProcess.on('exit', async (code, signal) => {
      this.logger.log('extProcess.pid exit', extProcess.pid, 'code', code, 'signal', signal);
      if (this.clientExtProcessMap.has(clientId)) {
        this.logger.error('extProcess crash', extProcess.pid, 'code', code, 'signal', signal);
        await this.disposeClientExtProcess(clientId, false, false);
        this.infoProcessCrash(clientId);
        this.reporterService.point(REPORT_NAME.EXTENSION_CRASH, clientId, {
          code,
          signal,
        });
      } else {
        this.logger.log('extProcess.pid exit by dispose', extProcess.pid);
      }
    });

    this.clientExtProcessMap.set(clientId, extProcess);

    this.logger.log('createProcess2', this.clientExtProcessMap.keys());
    const extProcessInitDeferred = new Deferred<void>();
    this.clientExtProcessInitDeferredMap.set(clientId, extProcessInitDeferred);

    this._getExtHostConnection2(clientId);

    await new Promise((resolve) => {
      const initHandler = (msg) => {
        if (msg === 'ready') {
          const duration = forkTimer.timeEnd();
          this.logger.log(`extension,fork,${clientId},${duration}ms`);
          extProcessInitDeferred.resolve();
          this.clientExtProcessFinishDeferredMap.set(clientId, new Deferred<void>());
          resolve();
        } else if (msg === 'finish') {
          const finishDeferred = this.clientExtProcessFinishDeferredMap.get(clientId);
          if (finishDeferred) {
            finishDeferred.resolve();
          }
        } else if (typeof msg === 'object' && msg.type === ProcessMessageType.REPORTER) {
          const reporterMessage: ReporterProcessMessage = msg.data;
          if (reporterMessage.reportType === REPORT_TYPE.PERFORMANCE) {
            this.reporter.performance(reporterMessage.name, reporterMessage.data as PerformanceData);
          } else if (reporterMessage.reportType === REPORT_TYPE.POINT) {
            this.reporter.point(reporterMessage.name, reporterMessage.data);
          }
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
      this.logger.log('mainThreadListenPath', mainThreadListenPath);

      try {
        if (!isWindows) {
          await fs.unlink(mainThreadListenPath);
        }
      } catch (e) {
        this.logger.error(e);
      }

      await new Promise((resolve) => {
        mainThreadServer.listen(mainThreadListenPath, () => {
          this.logger.log(`electron mainThread listen on ${mainThreadListenPath}`);
          resolve();
        });
      });

      mainThreadServer.on('connection', (connection) => {
        this.logger.log(`kaitian electron ext main connected ${clientId}`);

        handler({
          connection: {
            reader: new SocketMessageReader(connection),
            writer: new SocketMessageWriter(connection),
          },
          clientId,
        });

        connection.on('close', () => {
          this.logger.log('close disposeClientExtProcess clientId', clientId);
          this.disposeClientExtProcess(clientId);
        });

      });

    } else {
      commonChannelPathHandler.register('ExtMainThreadConnection', {
        handler: (connection: WSChannel, connectionClientId: string) => {
          this.logger.log(`kaitian ext main connected ${connectionClientId}`);

          const reader = new WebSocketMessageReader(connection);
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
            this.logger.log(`remove ext mainConnection ${connectionClientId} `);

            if (this.clientExtProcessExtConnection.has(connectionClientId)) {
              const extConnection: any = this.clientExtProcessExtConnection.get(connectionClientId);
              if (extConnection.writer) {
                extConnection.writer.dispose();
              }
              if (extConnection.reader) {
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
        this.logger.log('close disposeClientExtProcess clientId', connectionClientId);
        const disposer = this.disposeClientExtProcess(connectionClientId);
        if (isDevelopment()) {
          this.pendingClientExtProcessDisposer = disposer;
        }
      }, isDevelopment() ? 0 : (this.appConfig.processCloseExitThreshold || ExtensionNodeServiceImpl.ProcessCloseExitThreshold));
      this.clientExtProcessThresholdExitTimerMap.set(connectionClientId, timer);
    }
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

      this.clientExtProcessExtConnection.delete(clientId);
      this.clientExtProcessExtConnectionServer.delete(clientId);
      this.clientExtProcessFinishDeferredMap.delete(clientId);
      this.clientExtProcessInitDeferredMap.delete(clientId);
      this.clientExtProcessThresholdExitTimerMap.delete(clientId);
      this.clientExtProcessMap.delete(clientId);

      if (killProcess) {
        await new Promise((resolve) => {
          treeKill(extProcess.pid, (err) => {
            if (err) {
              this.logger.error(`tree kill error: \n ${err.message}`);
              return;
            }
            this.logger.log('extProcess killed', extProcess.pid);
            resolve();
          });
        });
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
        this.logger.error(e);
      }

      await new Promise((resolve) => {
        server.listen(listenPath, () => {
          this.logger.log(`electron mainThread listen on ${listenPath}`);
          resolve();
        });
      });

      return new Promise((resolve) => {

        const connectionHandler = (connection) => {
          this.logger.log('electron ext main connected');

          resolve({
            reader: new SocketMessageReader(connection),
            writer: new SocketMessageWriter(connection),
          });

          connection.on('close', () => {
            this.logger.log('remove electron ext main');
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
            this.logger.log('kaitian ext main connected');

            resolve({
              reader: new WebSocketMessageReader(connection),
              writer: new WebSocketMessageWriter(connection),
            });
          },
          dispose: () => {
            this.logger.log('remove _getMainThreadConnection handler');
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
      this.logger.log(`kaitian ext ${clientId} connected killed`);
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
    } catch (e) { }

    const extConnection = await new Promise((resolve) => {
      extServer.on('connection', (connection) => {
        this.logger.log('kaitian ext host connected');

        const connectionObj = {
          reader: new SocketMessageReader(connection),
          writer: new SocketMessageWriter(connection),
        };
        resolve(connectionObj);
      });
      extServer.listen(extServerListenPath, () => {
        this.logger.log(`kaitian ext server listen on ${extServerListenPath}`);
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

    const extConnection = await new Promise((resolve) => {
      extServer.on('connection', (connection) => {
        this.logger.log('kaitian _getExtHostConnection2 ext host connected');

        const connectionObj = {
          // reader: new SocketMessageReader(connection),
          // writer: new SocketMessageWriter(connection),
          connection,
        };
        resolve(connectionObj);
      });
      extServer.listen(extServerListenPath, () => {
        this.logger.log(`${clientId} kaitian ext server listen on ${extServerListenPath}`);
      });
    });

    this.clientExtProcessExtConnection.set(clientId, extConnection);
    return extConnection;
  }
}
