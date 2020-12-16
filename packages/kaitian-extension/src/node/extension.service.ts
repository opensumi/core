import * as path from 'path';
import * as net from 'net';
import * as fs from 'fs-extra';
import { Injectable, Autowired } from '@ali/common-di';
import { ExtensionScanner } from './extension.scanner';
import { IExtensionMetaData, IExtensionNodeService, ExtraMetaData, IExtensionNodeClientService, ProcessMessageType } from '../common';
import { Deferred, isDevelopment, INodeLogger, AppConfig, isWindows, isElectronNode, ReporterProcessMessage, IReporter, IReporterService, REPORT_TYPE, PerformanceData, REPORT_NAME } from '@ali/ide-core-node';
import { Event, Emitter, timeout, findFreePort, IReporterTimer } from '@ali/ide-core-common';
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
import { getShellPath } from '@ali/ide-core-node';

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

  private clientExtProcessMap: Map<string, cp.ChildProcess> = new Map();
  private clientExtProcessInspectPortMap: Map<string, number> = new Map();
  private clientExtProcessInitDeferredMap: Map<string, Deferred<void>> = new Map();
  private clientExtProcessExtConnection: Map<string, any> = new Map();
  private clientExtProcessExtConnectionServer: Map<string, net.Server> = new Map();
  private clientExtProcessFinishDeferredMap: Map<string, Deferred<void>> = new Map();
  private clientServiceMap: Map<string, IExtensionNodeClientService> = new Map();

  private inspectPort: number = 9889;

  private extensionScanner: ExtensionScanner;

  private readonly onDidSetInspectPort = new Emitter<void>();

  public setConnectionServiceClient(clientId: string, serviceClient: IExtensionNodeClientService) {
    this.clientServiceMap.set(clientId, serviceClient);
  }
  private extServerListenPaths: Map<string, string> = new Map();

  private electronMainThreadListenPaths: Map<string, string> = new Map();

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

      this.logger.log(`setExtProcessConnectionForward clientId ${clientId}`);

    });

  }

  public async createProcess(clientId: string) {
    this.logger.log('createProcess', this.instanceId);
    this.logger.log('appconfig exthost', this.appConfig.extHost);
    this.logger.log('createProcess clientId', clientId);

    const processClientIdArr = Array.from(this.clientExtProcessMap.keys());
    const maxExtProcessCount = this.appConfig.maxExtProcessCount || ExtensionNodeServiceImpl.MaxExtProcessCount;
    if (processClientIdArr.length >= maxExtProcessCount) {
      const killProcessClientId = processClientIdArr[0];
      await this.disposeClientExtProcess(killProcessClientId);
      this.logger.error(`Process count is over limit, max count is ${maxExtProcessCount}`);
    }

    let preloadPath;
    let forkOptions: cp.ForkOptions = {
      // 防止 childProcess.stdout 为 null
      silent: true,
    };
    // TODO: 软链模式下的路径兼容性存在问题
    if (isElectronNode()) {
      this.logger.verbose('try get shell path for extension process');
      let shellPath: string | undefined;
      try {
        shellPath = await getShellPath() || '';
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
        this.logger.error('shell path error: ',  e);
      }
      forkOptions = {
        ...forkOptions,
        env: {
          ...process.env,
          // 可能会有获取失败的情况
          PATH: shellPath ? shellPath : process.env.PATH,
         },
      };
    } else {
      forkOptions = {
        ...forkOptions,
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
      //
      // 开发模式下指定调试端口时，尝试从指定的端口开始寻找可用的空闲端口
      // 避免打开多个窗口(多个插件进程)时端口被占用
      //
      const port = await findFreePort(this.inspectPort, 10, 5000);
      forkOptions.execArgv.push('--nolazy');
      forkOptions.execArgv.push(`--inspect=${port}`);
      this.clientExtProcessInspectPortMap.set(clientId, port);
    }

    const forkTimer = this.reporterService.time(`${clientId} fork ext process`);
    const extProcess = cp.fork(extProcessPath, forkArgs, forkOptions);
    //
    // 监听进程输出，用于获取调试端口
    //
    this.addProcessInspectListener(clientId, extProcess);

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

    this.logger.log('createProcess', this.clientExtProcessMap.keys());
    const extProcessInitDeferred = new Deferred<void>();
    this.clientExtProcessInitDeferredMap.set(clientId, extProcessInitDeferred);

    this._getExtHostConnection2(clientId);

    this.processHandshake(extProcess, forkTimer, clientId);
    return extProcess;
  }

  public async ensureProcessReady(clientId: string): Promise<boolean> {
    if (!this.clientExtProcessInitDeferredMap.has(clientId)) {
      return false;
    }

    const initDeferred = this.clientExtProcessInitDeferredMap.get(clientId);
    await initDeferred?.promise;
    return true;
  }

  private async processHandshake(extProcess: cp.ChildProcess, forkTimer: IReporterTimer, clientId: string): Promise<void> {
    const extProcessInitDeferred = this.clientExtProcessInitDeferredMap.get(clientId);
    await new Promise((resolve) => {
      const initHandler = (msg) => {
        if (msg === 'ready') {
          const duration = forkTimer.timeEnd();
          this.logger.log(`extension,fork,${clientId},${duration}ms`);
          extProcessInitDeferred!.resolve();
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

  /**
   * 这里的作用是在**非开发模式下**(isDevelopment() === false), 通过 process._debugProcess 启动调试时，见 [this.tryEnableInspectPort](#tryEnableInspectPort)
   * 监听 stdout 的输出获取调试端口
   * @example
   * ```ts
   * process._debugProcess(<extHostProcess.pid>);
   *
   * // stdout:
   * // Debugger listening on ws://127.0.0.1:<port>/f3f6f226-7dbc-4009-95fa-d516ba132fbd
   * // For help see https://nodejs.org/en/docs/inspector
   * ```
   */
  private addProcessInspectListener(clientId: string, extProcess: cp.ChildProcess) {
    // Catch all output coming from the extension host process
    interface Output { data: string; format: string[]; }
    extProcess.stdout!.setEncoding('utf8');
    extProcess.stderr!.setEncoding('utf8');
    const onStdout = Event.fromNodeEventEmitter<string>(extProcess.stdout!, 'data');
    const onStderr = Event.fromNodeEventEmitter<string>(extProcess.stderr!, 'data');
    const onOutput = Event.any(
      Event.map(onStdout, (o) => ({ data: `%c${o}`, format: [''] })),
      Event.map(onStderr, (o) => ({ data: `%c${o}`, format: ['color: red'] })),
    );

    // Debounce all output, so we can render it in the Chrome console as a group
    const onDebouncedOutput = Event.debounce<Output>(onOutput, (r, o) => {
      return r
        ? { data: r.data + o.data, format: [...r.format, ...o.format] }
        : { data: o.data, format: o.format };
    }, 100);

    onDebouncedOutput((output) => {
      const inspectorUrlMatch = output.data && output.data.match(/ws:\/\/([^\s]+:(\d+)\/[^\s]+)/);
      if (inspectorUrlMatch) {
        const port = Number(inspectorUrlMatch[2]);
        this.clientExtProcessInspectPortMap.set(clientId, port);
        this.onDidSetInspectPort.fire();
      }
    });
  }

  async tryEnableInspectPort(clientId: string, delay?: number): Promise<boolean> {
    if (this.clientExtProcessInspectPortMap.has(clientId)) {
      return true;
    }
    const extHostProcess = this.clientExtProcessMap.get(clientId);
    if (!extHostProcess) {
      return false;
    }

    interface ProcessExt {
      _debugProcess?(n: number): any;
    }

    if (typeof (process as ProcessExt)._debugProcess === 'function') {
      // use (undocumented) _debugProcess feature of node
      try {
        // 这里不知道 jest 什么原理，去掉 console.log 测试必挂...
        // tslint:disable-next-line
        console.log(`do open inspect port, pid: ${extHostProcess.pid}`);
        (process as ProcessExt)._debugProcess!(extHostProcess.pid);
      } catch (err) {
        this.logger.error(`enable inspect port error \n ${err.message}`);
        return false;
      }

      await Promise.race([Event.toPromise(this.onDidSetInspectPort.event), timeout(delay || 1000)]);
      return typeof this.clientExtProcessInspectPortMap.get(clientId) === 'number';
    } else if (!isWindows) {
      // use KILL USR1 on non-windows platforms (fallback)
      extHostProcess.kill('SIGUSR1');
      await Promise.race([Event.toPromise(this.onDidSetInspectPort.event), timeout(delay || 1000)]);
      return typeof this.clientExtProcessInspectPortMap.get(clientId) === 'number';
    }

    return false;
  }

  getProcessInspectPort(clientId: string): number | undefined {
    const extHostProcess = this.clientExtProcessMap.get(clientId);
    if (!extHostProcess || extHostProcess.killed) {
      return;
    }
    return this.clientExtProcessInspectPortMap.get(clientId);
  }

  private async _setMainThreadConnection(handler) {

    if (process.env.KTELECTRON) {
      const clientId = process.env.CODE_WINDOW_CLIENT_ID as string;
      const mainThreadServer: net.Server = net.createServer();
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
          // electron 只要端口进程就杀死插件进程
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
          });

        },
        dispose: (connection, connectionClientId) => {
          // FIXME: 暂时先不杀掉
          // this.disposeClientExtProcess(connectionClientId);
        },
      });
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

    }
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
