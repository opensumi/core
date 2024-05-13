import net from 'net';
import path from 'path';
import util from 'util';

import { Autowired, Injectable } from '@opensumi/di';
import { WSChannel } from '@opensumi/ide-connection';
import { NetSocketConnection } from '@opensumi/ide-connection/lib/common/connection';
import { commonChannelPathHandler } from '@opensumi/ide-connection/lib/node';
import {
  Emitter,
  Event,
  ExtensionConnectModeOption,
  ExtensionConnectOption,
  IReporterTimer,
  SupportLogNamespace,
  getDebugLogger,
  isUndefined,
  pMemoize,
  timeout,
} from '@opensumi/ide-core-common';
import { findFreePort } from '@opensumi/ide-core-common/lib/node/port';
import { normalizedIpcHandlerPathAsync } from '@opensumi/ide-core-common/lib/utils/ipc';
import {
  AppConfig,
  Deferred,
  INodeLogger,
  IReporter,
  IReporterService,
  PerformanceData,
  REPORT_NAME,
  REPORT_TYPE,
  ReporterProcessMessage,
  getShellPath,
  isDevelopment,
  isElectronNode,
  isWindows,
} from '@opensumi/ide-core-node';

import {
  CONNECTION_HANDLE_BETWEEN_EXTENSION_AND_MAIN_THREAD,
  ICreateProcessOptions,
  IExtensionHostManager,
  IExtensionMetaData,
  IExtensionNodeClientService,
  IExtensionNodeService,
  IExtraMetaData,
  KT_APP_CONFIG_KEY,
  KT_PROCESS_SOCK_OPTION_KEY,
  OutputType,
  ProcessMessageType,
} from '../common';

import { ExtensionScanner } from './extension.scanner';

import type cp from 'child_process';

@Injectable()
export class ExtensionNodeServiceImpl implements IExtensionNodeService {
  private instanceId = 'ExtensionNodeServiceImpl:' + Date.now();
  static MaxExtProcessCount = 5;
  // ws 断开 5 分钟后杀掉插件进程
  static ProcessCloseExitThreshold: number = 5 * 60 * 1000;

  @Autowired(INodeLogger)
  private readonly logger: INodeLogger;

  private readonly extHostLogger = getDebugLogger(SupportLogNamespace.ExtensionHost);

  @Autowired(AppConfig)
  private appConfig: AppConfig;

  @Autowired(IReporterService)
  reporterService: IReporterService;

  @Autowired(IReporter)
  reporter: IReporter;

  @Autowired(IExtensionHostManager)
  private extensionHostManager: IExtensionHostManager;

  private clientExtProcessMap: Map<string, number> = new Map();
  private clientExtProcessInspectPortMap: Map<string, number> = new Map();
  private clientExtProcessInitDeferredMap: Map<string, Deferred<void>> = new Map();
  private clientExtProcessExtConnection: Map<string, NetSocketConnection> = new Map();
  private clientExtProcessExtConnectionDeferredMap: Map<string, Deferred<void>> = new Map();
  private clientExtProcessExtConnectionServer: Map<string, net.Server> = new Map();
  private clientExtProcessFinishDeferredMap: Map<string, Deferred<void>> = new Map();
  private clientExtProcessThresholdExitTimerMap: Map<string, NodeJS.Timeout> = new Map();
  private clientServiceMap: Map<string, IExtensionNodeClientService> = new Map();
  private maybeZombieClients: Set<string> = new Set();
  // 最新的插件进程的对应的进程 Id
  private latestExtProcessId: number = -1;

  private inspectPort = 9889;

  private extensionScanner: ExtensionScanner;

  private readonly onDidSetInspectPort = new Emitter<void>();

  public setConnectionServiceClient(clientId: string, serviceClient: IExtensionNodeClientService) {
    this.clientServiceMap.set(clientId, serviceClient);
  }

  private extServerListenOptions: Map<string, net.ListenOptions> = new Map();

  private electronMainThreadListenPaths: Map<string, string> = new Map();

  public async initialize() {
    await this.extensionHostManager.init();
    this.setExtProcessConnectionForward();
  }

  public async getAllExtensions(
    scan: string[],
    extensionCandidate: string[],
    localization: string,
    extraMetaData: IExtraMetaData = {},
  ): Promise<IExtensionMetaData[]> {
    // 扫描内置插件和插件市场的插件目录
    this.extensionScanner = new ExtensionScanner(
      [...scan, this.appConfig.marketplace.extensionDir],
      localization,
      extensionCandidate,
      extraMetaData,
    );
    return this.extensionScanner.run();
  }

  async getExtension(
    extensionPath: string,
    localization: string,
    extraMetaData?: IExtraMetaData,
  ): Promise<IExtensionMetaData | undefined> {
    return await ExtensionScanner.getExtension(extensionPath, localization, extraMetaData);
  }

  private async getIPCHandlerPath(name: string) {
    return await normalizedIpcHandlerPathAsync(name, true, this.appConfig.extHostIPCSockPath);
  }

  public async getExtServerListenOption(
    clientId: string,
    extensionConnectOption?: ExtensionConnectOption,
  ): Promise<net.ListenOptions> {
    if (!this.extServerListenOptions.has(clientId)) {
      const { mode = ExtensionConnectModeOption.IPC, host } = extensionConnectOption || {};
      const options: net.ListenOptions = {};

      if (mode === ExtensionConnectModeOption.IPC) {
        options.path = await this.getIPCHandlerPath('ext_process');
      } else {
        options.port = await findFreePort(this.inspectPort, 10, 5000);
        options.host = host;
      }

      this.extServerListenOptions.set(clientId, options);
    }

    return this.extServerListenOptions.get(clientId)!;
  }

  public async getElectronMainThreadListenPath(clientId: string): Promise<string> {
    if (!this.electronMainThreadListenPaths.has(clientId)) {
      this.electronMainThreadListenPaths.set(clientId, await this.getIPCHandlerPath('main_thread'));
    }
    return this.electronMainThreadListenPaths.get(clientId)!;
  }

  public async getElectronMainThreadListenPath2(clientId: string): Promise<string> {
    return await this.getElectronMainThreadListenPath(clientId);
  }

  private setExtProcessConnectionForward() {
    this.logger.log('setExtProcessConnectionForward', this.instanceId);
    this._setMainThreadConnection(async (connectionResult) => {
      const { channel, clientId } = connectionResult;
      this.maybeZombieClients.delete(clientId);
      await this.clientExtProcessExtConnectionDeferredMap.get(clientId)?.promise;

      const extProcessId = this.clientExtProcessMap.get(clientId);
      const extProcessNotExist =
        isUndefined(extProcessId) ||
        !(
          (await this.extensionHostManager.isRunning(extProcessId)) && this.clientExtProcessExtConnection.has(clientId)
        );

      if (extProcessNotExist) {
        this.logger.error(`${clientId} clientId process connection not exists, try to notify client to restart`);
        /**
         * 如果前端与后端连接后发现没有对应的插件进程实例，那么通知前端重启插件进程
         * 已知如下场景会出现这种情况：
         * 1. 用户关闭电脑超过 ProcessCloseExitThreshold 设定的最大时间，插件进程被杀死后，前端再次建立连接时
         * 2. Node 进程被杀死，插件进程也会被杀死
         */
        this.restartExtProcessByClient(clientId);
        this.reporterService.point(REPORT_NAME.EXTENSION_NOT_EXIST, clientId);
        return;
      }

      const extConnection = this.clientExtProcessExtConnection.get(clientId)!;

      extConnection.onMessage((data) => {
        channel.sendBinary(data);
      });

      extConnection.onceClose(() => {
        channel.close();
      });

      channel.onBinary((data) => {
        extConnection.send(data);
      });

      // 连接恢复后清除销毁的定时器
      if (this.clientExtProcessThresholdExitTimerMap.has(clientId)) {
        const timer = this.clientExtProcessThresholdExitTimerMap.get(clientId) as NodeJS.Timeout;
        clearTimeout(timer);
      }

      this.logger.log(`setExtProcessConnectionForward clientId ${clientId}`);
    });
  }

  public async createProcess(clientId: string, options?: ICreateProcessOptions) {
    this.logger.log('createProcess instanceId', this.instanceId);
    this.logger.log('appconfig exthost', this.appConfig.extHost);
    this.logger.log('createProcess clientId', clientId);

    // 检查是否超过限制最大的进程数
    const processClientIdArr = Array.from(this.clientExtProcessMap.keys());
    const maxExtProcessCount = this.appConfig.maxExtProcessCount || ExtensionNodeServiceImpl.MaxExtProcessCount;
    if (processClientIdArr.length >= maxExtProcessCount) {
      const killProcessClientId = processClientIdArr[0];
      this.disposeClientExtProcess(killProcessClientId);
      this.logger.error(`Process count is over limit, max count is ${maxExtProcessCount}`);
    }
    await this._createExtServer(clientId, options);
    await this._createExtHostProcess(clientId, options);
  }

  private async _createExtServer(clientId: string, options?: ICreateProcessOptions) {
    // 创建插件进程监听的 socket
    const extServerListenOptions = await this.getExtServerListenOption(clientId, options?.extensionConnectOption);
    // 先使用单个 server，再尝试单个 server 与多个进程进行连接
    const extServer = net.createServer();
    this.clientExtProcessExtConnectionServer.set(clientId, extServer);

    extServer.on('connection', (connection) => {
      this.logger.log('_setupExtHostConnection ext host connected');

      this.clientExtProcessExtConnection.set(clientId, new NetSocketConnection(connection));
      this.clientExtProcessExtConnectionDeferredMap.get(clientId)?.resolve();
    });

    this.clientExtProcessExtConnectionDeferredMap.set(clientId, new Deferred<void>());

    extServer.listen(extServerListenOptions, () => {
      this.logger.log(`${clientId} ext server listen on ${JSON.stringify(extServerListenOptions)}`);
    });

    // 重启时，旧的 path 已经不再使用，但是系统未清理，导致 listen 会失败，所以在连接关闭时，主动清理
    extServer.once('close', () => {
      this.extServerListenOptions.delete(clientId);
    });
  }

  @pMemoize((clientId: string) => clientId)
  private async _createExtHostProcess(clientId: string, options?: ICreateProcessOptions) {
    // 在新进程创建前销毁可能存在的僵尸进程
    this.destoryZombineClients();
    let preloadPath: string;
    let forkOptions: cp.ForkOptions = {
      // 防止 childProcess.stdout 为 null
      silent: true,
      env: {
        // 显式设置 env，因为需要和插件运行环境的 env merge
        ...process.env,
      },
    };
    // 软链模式下的路径兼容性存在问题
    if (isElectronNode()) {
      this.logger.verbose('try get shell path for extension process');
      let shellPath: string | undefined;
      try {
        shellPath = (await getShellPath()) || '';
        // 在某些机型上，可能存在由于权限问题导致的获取的 shell path 比当前给的 path 还少的情况，这种情况下对 PATH 做一下 merge
        if (shellPath && process.env.PATH) {
          const paths = shellPath.split(':');
          process.env.PATH.split(':').forEach((path) => {
            if (paths.indexOf(path) === -1) {
              paths.push(path);
            }
          });
          shellPath = paths.join(':');
        }
        this.logger.verbose('shell path result: ' + shellPath);
      } catch (e) {
        this.logger.error('shell path error: ', e);
      }
      forkOptions = {
        ...forkOptions,
        env: {
          ...forkOptions.env,
          // 可能会有获取失败的情况
          PATH: shellPath ? shellPath : process.env.PATH,
        },
      };
    }
    const forkArgs: string[] = [];
    const extServerListenOption = await this.getExtServerListenOption(clientId, options?.extensionConnectOption);

    let extProcessPath = '';
    forkOptions.execArgv = [];

    forkArgs.push(`--${KT_PROCESS_SOCK_OPTION_KEY}=${JSON.stringify(extServerListenOption)}`);

    if (isElectronNode()) {
      extProcessPath = this.appConfig.extHost || (process.env.EXTENSION_HOST_ENTRY as string);
    } else {
      preloadPath =
        process.env.EXT_MODE === 'js'
          ? path.join(__dirname, '../../lib/hosted/ext.host.js')
          : path.join(__dirname, '../hosted/ext.host' + path.extname(module.filename));
      if (process.env.EXT_MODE !== 'js' && module.filename.endsWith('.ts')) {
        forkOptions.execArgv = forkOptions.execArgv.concat(['-r', 'ts-node/register', '-r', 'tsconfig-paths/register']);
      }

      forkArgs.push(`--kt-process-preload=${preloadPath}`);
      if (this.appConfig.extHost) {
        extProcessPath = this.appConfig.extHost;
      } else {
        extProcessPath =
          process.env.EXT_MODE === 'js'
            ? path.join(__dirname, '../../hosted/ext.process.js')
            : path.join(__dirname, '../hosted/ext.process' + path.extname(module.filename));
      }
    }
    this.logger.log(`Extension host process path ${extProcessPath}`);

    // 注意只能传递可以序列化的数据
    forkArgs.push(
      `--${KT_APP_CONFIG_KEY}=${JSON.stringify({
        logDir: this.appConfig.logDir,
        logLevel: this.appConfig.logLevel,
        extLogServiceClassPath: this.appConfig.extLogServiceClassPath,
      })}`,
    );

    if (options?.enableDebugExtensionHost || isDevelopment()) {
      // 开发模式下指定调试端口时，尝试从指定的端口开始寻找可用的空闲端口
      // 避免打开多个窗口(多个插件进程)时端口被占用

      const port = await this.extensionHostManager.findDebugPort(this.inspectPort, 10, 5000);
      forkOptions.execArgv.push('--nolazy');
      if (options?.inspectExtensionHost) {
        forkOptions.execArgv.push(`--inspect=${options.inspectExtensionHost}:${port}`);
      } else {
        forkOptions.execArgv.push(`--inspect=${port}`);
      }
      this.clientExtProcessInspectPortMap.set(clientId, port);
    }

    const forkTimer = this.reporterService.time(`${clientId} fork ext process`);
    const extProcessId = await this.extensionHostManager.fork(extProcessPath, forkArgs, {
      ...forkOptions,
      ...this.appConfig.extHostForkOptions,
    });
    this.latestExtProcessId = extProcessId;
    this.logger.log(`Fork extension host process with id ${extProcessId}`);
    // 监听进程输出，用于获取调试端口
    this.extensionHostManager.onOutput(extProcessId, (output) => {
      const inspectorUrlMatch = output.data && output.data.match(/ws:\/\/([^\s]+:(\d+)\/[^\s]+)/);
      if (inspectorUrlMatch) {
        const port = Number(inspectorUrlMatch[2]);
        this.clientExtProcessInspectPortMap.set(clientId, port);
        this.onDidSetInspectPort.fire();
      } else {
        // 输出插件进程日志
        if (output.type === OutputType.STDERR) {
          this.extHostLogger.error(util.format(output.data, ...output.format));
        } else {
          this.extHostLogger.log(util.format(output.data, ...output.format));
        }
      }
    });

    this.extensionHostManager.onExit(extProcessId, async (code: number, signal: string) => {
      this.logger.log(`Extension host process ${extProcessId} exit by code ${code} signal ${signal}`);
      if (this.clientExtProcessMap.get(clientId) === extProcessId) {
        await this.disposeClientExtProcess(clientId, false, false);
        this.infoProcessCrash(clientId);
        this.reporterService.point(REPORT_NAME.EXTENSION_CRASH, clientId, {
          code,
          signal,
        });
      } else {
        this.logger.log(`Extension host process ${extProcessId} exit by dispose`);
      }
    });

    this.clientExtProcessMap.set(clientId, extProcessId);
    const extProcessInitDeferred = new Deferred<void>();
    this.clientExtProcessInitDeferredMap.set(clientId, extProcessInitDeferred);
    this.processHandshake(extProcessId, forkTimer, clientId);
  }

  public async ensureProcessReady(clientId: string): Promise<boolean> {
    if (!this.clientExtProcessInitDeferredMap.has(clientId)) {
      return false;
    }

    await this.clientExtProcessInitDeferredMap.get(clientId)?.promise;
    return true;
  }

  private processHandshake(extProcessId: number, forkTimer: IReporterTimer, clientId: string): void {
    const initHandler = (msg) => {
      if (msg === 'ready') {
        const duration = forkTimer.timeEnd();
        this.logger.log(`Starting extension host with pid ${extProcessId} (fork() took ${duration} ms).`);
        this.clientExtProcessInitDeferredMap.get(clientId)?.resolve();
        this.clientExtProcessFinishDeferredMap.set(clientId, new Deferred<void>());
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
    this.extensionHostManager.onMessage(extProcessId, initHandler);
  }

  async tryEnableInspectPort(clientId: string, delay?: number): Promise<boolean> {
    if (this.clientExtProcessInspectPortMap.has(clientId)) {
      return true;
    }
    const extHostProcessId = this.clientExtProcessMap.get(clientId);
    if (isUndefined(extHostProcessId)) {
      return false;
    }

    interface ProcessExt {
      _debugProcess?(n: number): any;
    }

    if (typeof (process as ProcessExt)._debugProcess === 'function') {
      // use (undocumented) _debugProcess feature of node
      try {
        (process as ProcessExt)._debugProcess!(extHostProcessId);
      } catch (err) {
        this.logger.error(`Enable inspect port error \n ${err.message}`);
        return false;
      }

      await Promise.race([Event.toPromise(this.onDidSetInspectPort.event), timeout(delay || 1000)]);
      return typeof this.clientExtProcessInspectPortMap.get(clientId) === 'number';
    } else if (!isWindows) {
      // use KILL USR1 on non-windows platforms (fallback)
      await this.extensionHostManager.kill(extHostProcessId, 'SIGUSR1');
      await Promise.race([Event.toPromise(this.onDidSetInspectPort.event), timeout(delay || 1000)]);
      return typeof this.clientExtProcessInspectPortMap.get(clientId) === 'number';
    }

    return false;
  }

  async getProcessInspectPort(clientId: string) {
    const extHostProcessId = this.clientExtProcessMap.get(clientId);
    if (!extHostProcessId || !(await this.extensionHostManager.isRunning(extHostProcessId))) {
      return;
    }
    return this.clientExtProcessInspectPortMap.get(clientId);
  }

  private async _setMainThreadConnection(
    handler: (connectionResult: { channel: WSChannel; clientId: string }) => void,
  ) {
    commonChannelPathHandler.register(CONNECTION_HANDLE_BETWEEN_EXTENSION_AND_MAIN_THREAD, {
      handler: (channel: WSChannel, clientId: string) => {
        handler({
          channel,
          clientId,
        });

        channel.onceClose(() => {
          channel.dispose();
          this.logger.log(`The connection client ${clientId} closed`);

          if (this.clientExtProcessExtConnection.has(clientId)) {
            const extConnection = this.clientExtProcessExtConnection.get(clientId)!;
            if (extConnection) {
              this.clientExtProcessExtConnection.delete(clientId);
              extConnection.dispose();
              extConnection.destroy();
            }
          }
          this.maybeZombieClients.add(clientId);
          this.closeExtProcessWhenConnectionClose(clientId);
        });
      },
      dispose: () => {},
    });
  }

  private closeExtProcessWhenConnectionClose(connectionClientId: string) {
    if (this.clientExtProcessMap.has(connectionClientId)) {
      if (isElectronNode()) {
        // in electron, if current connection is closed, kill the ext process immediately
        this.disposeClientExtProcess(connectionClientId);
      } else {
        // 为了保证体验，最后一个创建的插件进程断连后不杀死
        // https://github.com/opensumi/core/issues/3653
        if (this.clientExtProcessMap.get(connectionClientId) === this.latestExtProcessId) {
          return;
        }
        /**
         * in web, if current connection is closed, kill the ext process after a threshold
         */
        const timer = global.setTimeout(() => {
          this.logger.log(`Dispose client by connectionClientId ${connectionClientId}`);
          this.disposeClientExtProcess(connectionClientId);
        }, this.appConfig.processCloseExitThreshold ?? ExtensionNodeServiceImpl.ProcessCloseExitThreshold);
        this.clientExtProcessThresholdExitTimerMap.set(connectionClientId, timer);
      }
    }
  }

  private clean;

  private infoProcessNotExist(clientId: string) {
    if (this.clientServiceMap.has(clientId)) {
      (this.clientServiceMap.get(clientId) as IExtensionNodeClientService).infoProcessNotExist();
      this.clientServiceMap.delete(clientId);
    }
  }

  /**
   * 如果插件进程已被销毁，如 websocket 连接断开超过 `ExtensionNodeServiceImpl.ProcessCloseExitThreshold` 时
   * 那么当用户重新连接至服务时，需要通知重启整个插件进程
   */
  private restartExtProcessByClient(clientId: string) {
    if (this.clientServiceMap.has(clientId)) {
      (this.clientServiceMap.get(clientId) as IExtensionNodeClientService).restartExtProcessByClient();
    }
  }

  private infoProcessCrash(clientId: string) {
    if (this.clientServiceMap.has(clientId)) {
      (this.clientServiceMap.get(clientId) as IExtensionNodeClientService).infoProcessCrash();
    }
  }

  public async disposeClientExtProcess(clientId: string, info = true, killProcess = true) {
    const extProcessId = this.clientExtProcessMap.get(clientId);
    try {
      if (!isUndefined(extProcessId)) {
        if (await this.extensionHostManager.isRunning(extProcessId)) {
          await this.extensionHostManager.send(extProcessId, 'close');
          // deactivate
          // subscription
          if (this.clientExtProcessFinishDeferredMap.has(clientId)) {
            await (this.clientExtProcessFinishDeferredMap.get(clientId) as Deferred<void>).promise;
          }
        }

        // extServer 关闭
        if (this.clientExtProcessExtConnectionServer.has(clientId)) {
          this.clientExtProcessExtConnectionServer.get(clientId)!.close();
          this.clientExtProcessExtConnectionServer.delete(clientId);
        }
        // connect 关闭
        if (this.clientExtProcessExtConnection.has(clientId)) {
          this.clientExtProcessExtConnection.get(clientId)!.destroy();
          this.clientExtProcessExtConnection.delete(clientId);
        }

        this.clientExtProcessExtConnectionDeferredMap.delete(clientId);
        this.clientExtProcessFinishDeferredMap.delete(clientId);
        this.clientExtProcessInitDeferredMap.delete(clientId);
        this.clientExtProcessMap.delete(clientId);
        this.maybeZombieClients.delete(clientId);

        if (killProcess) {
          await this.extensionHostManager.treeKill(extProcessId);
          await this.extensionHostManager.disposeProcess(extProcessId);
        }
        if (info) {
          this.infoProcessNotExist(clientId);
        }
        this.logger.log(`Extension host process disposed by clientId ${clientId}`);
      }
    } catch (e) {
      this.logger.error(`Close extension host process when connection throw error\n${e.message}`);
    }
  }

  public async getExtProcessId(clientId: string): Promise<number | null> {
    if (this.clientExtProcessMap.has(clientId)) {
      return this.clientExtProcessMap.get(clientId)!;
    }

    return null;
  }

  public async disposeAllClientExtProcess(): Promise<void> {
    await this.extensionHostManager.dispose();
  }

  private destoryZombineClients() {
    for (const clientId of this.maybeZombieClients) {
      this.disposeClientExtProcess(clientId);
    }
  }
}
