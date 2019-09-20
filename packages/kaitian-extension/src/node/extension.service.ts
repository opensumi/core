import * as path from 'path';
import * as os from 'os';
import * as net from 'net';
import * as fs from 'fs-extra';
import { Injectable, Autowired } from '@ali/common-di';
import { ExtensionScanner } from './extension.scanner';
import { IExtensionMetaData, IExtensionNodeService, ExtraMetaData } from '../common';
import { getLogger, Deferred, isDevelopment, INodeLogger } from '@ali/ide-core-node';
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

const MOCK_CLIENT_ID = 'MOCK_CLIENT_ID';

@Injectable()
export class ExtensionNodeServiceImpl implements IExtensionNodeService  {

  private instanceId = 'ExtensionNodeServiceImpl:' + new Date();
  static MaxExtProcesCount: number = Infinity;
  @Autowired(INodeLogger)
  logger: INodeLogger;

  private extProcess: cp.ChildProcess;
  private extProcessClientId: string;

  private clientExtProcessMap: Map<string, cp.ChildProcess> = new Map();
  private clientExtProcessInitDeferredMap: Map<string, Deferred<void>> = new Map();
  private clientExtProcessExtConnection: Map<string, any> = new Map();
  private clientExtProcessExtConnectionServer: Map<string, net.Server> = new Map();
  private clientExtProcessFinishDeferredMap: Map<string, Deferred<void>> = new Map();

  private extServer: net.Server;
  private electronMainThreadServer: net.Server;
  private extConnection;
  private connectionDeffered: Deferred<void>;
  private initDeferred: Deferred<void>;
  private clientId;
  private clientProcessMap: Map<string, cp.ChildProcess>;
  private extensionScanner: ExtensionScanner;

  public async getAllExtensions(scan: string[], extenionCandidate: string[], extraMetaData: {[key: string]: any}): Promise<IExtensionMetaData[]> {
    this.extensionScanner = new ExtensionScanner(scan, extenionCandidate, extraMetaData);
    return this.extensionScanner.run();
  }

  async getExtension(extensionPath: string, extraMetaData?: ExtraMetaData): Promise<IExtensionMetaData | undefined> {
    return await ExtensionScanner.getExtension(extensionPath, extraMetaData);
  }

  public getExtServerListenPath(clientId: string): string {
    return path.join(os.homedir(), `.kt_ext_process_${clientId}_sock`);
  }
  public getElectronMainThreadListenPath(clientId: string): string {
    return path.join(os.homedir(), `.kt_electron_main_thread_${clientId}_sock`);
  }

  public getElectronMainThreadListenPath2(clientId: string): string {
    return path.join(os.homedir(), `.kt_electron_main_thread_${clientId}_sock`);
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

  // 待废弃
  public async preCreateProcess() {

    const preloadPath = process.env.EXT_MODE === 'js' ? path.join(__dirname, '../../lib/hosted/ext.host.js') : path.join(__dirname, '../hosted/ext.host' + path.extname(module.filename));
    const forkOptions: cp.ForkOptions =  {};
    const forkArgs: string[] = [];
    forkOptions.execArgv = [];

    // ts-node模式
    if (process.env.EXT_MODE !== 'js' && module.filename.endsWith('.ts')) {
      forkOptions.execArgv = forkOptions.execArgv.concat(['-r', 'ts-node/register', '-r', 'tsconfig-paths/register']);
    }

    // if (isDevelopment()) {
    //   forkOptions.execArgv.push('--inspect=9889');
    // }

    forkArgs.push(`--kt-process-preload=${preloadPath}`);
    forkArgs.push(`--kt-process-sockpath=${this.getExtServerListenPath(MOCK_CLIENT_ID)}`);

    const extProcessPath = process.env.EXT_MODE === 'js' ? path.join(__dirname, '../../lib/hosted/ext.process.js') : path.join(__dirname, '../hosted/ext.process' + path.extname(module.filename));
    console.time('fork ext process');
    console.log('extProcessPath', extProcessPath);
    const extProcess = cp.fork(extProcessPath, forkArgs, forkOptions);
    this.logger.debug('extProcess.pid', extProcess.pid);

    this.extProcess = extProcess;

    const initDeferred = new Deferred<void>();
    this.initDeferred = initDeferred;

    const initHandler = (msg) => {
      if (msg === 'ready') {
        console.timeEnd('fork ext process');
        initDeferred.resolve();
      }
      // extProcess.removeListener('message', initHandler);
    };
    extProcess.on('message', initHandler);

    const extConnection = await this._getExtHostConnection(MOCK_CLIENT_ID);

    this._setMainThreadConnection((connectionResult) => {
      const {connection: mainThreadConnection, clientId} = connectionResult;

      if (!this.extProcessClientId) {
        this.extProcessClientId = clientId;

        // @ts-ignore
        mainThreadConnection.reader.listen((input) => {
          // @ts-ignore
          extConnection.writer.write(input);
        });
        // @ts-ignore
        extConnection.reader.listen((input) => {
          // @ts-ignore
          mainThreadConnection.writer.write(input);
        });

      } else {
        // 重连通信进程串联
        if (this.extProcessClientId === clientId) {
            // TODO: isrunning 进程运行判断
            // TODO: 进程挂掉之后，重启前台 API 同步状态

            // @ts-ignore
            mainThreadConnection.reader.listen((input) => {
              // @ts-ignore
              extConnection.writer.write(input);
            });
            // @ts-ignore
            extConnection.reader.listen((input) => {
              // @ts-ignore
              mainThreadConnection.writer.write(input);
            });
        } else {
            // TODO: 拿到前台的远程调用的消息相关的 service 进行调用通知
            console.log(`已有插件连接 ${this.extProcessClientId}，新增连接 ${clientId} 无法再创建插件进程`);
        }
      }
    });
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

        console.log('this.clientExtProcessMap', self.clientExtProcessMap);
        // 进程未调用启动直接连接
        // TODO: 采用进程缓存的思路的话，则是进程被杀掉，然后重连进来
        this.logger.log(`${clientId} clientId process connection set error`, self.clientExtProcessMap.has(clientId), self.clientExtProcessMap.has(clientId) ? isRunning( (this.clientExtProcessMap.get(clientId) as cp.ChildProcess).pid) : false , this.clientExtProcessExtConnection.has(clientId));
        return;
      }

      const extConnection = this.clientExtProcessExtConnection.get(clientId);

      mainThreadConnection.reader.listen((input) => {
        extConnection.writer.write(input);
      });
      extConnection.reader.listen((input) => {
        mainThreadConnection.writer.write(input);
      });

      console.log('setExtProcessConnectionForward clientId');

    });

  }

  public async createProcess2(clientId: string) {
    console.log('createProcess2', this.instanceId);
    this.logger.log('createProcess2 clientId', clientId);

    let preloadPath;
    const forkOptions: cp.ForkOptions =  {};
    const forkArgs: string[] = [];
    let extProcessPath: string = '';

    if (process.env.KTELECTRON) {
      extProcessPath = process.env.EXTENSION_HOST_ENTRY as string;
      forkArgs.push(`--kt-process-sockpath=${this.getExtServerListenPath(clientId)}`);
    } else {
      preloadPath = process.env.EXT_MODE === 'js' ? path.join(__dirname, '../../lib/hosted/ext.host.js') : path.join(__dirname, '../hosted/ext.host' + path.extname(module.filename));
      forkOptions.execArgv = [];

      // ts-node模式
      if (process.env.EXT_MODE !== 'js' && module.filename.endsWith('.ts')) {
        forkOptions.execArgv = forkOptions.execArgv.concat(['-r', 'ts-node/register', '-r', 'tsconfig-paths/register']);
      }

      // if (isDevelopment()) {
      //   forkOptions.execArgv.push('--inspect=9889');
      // }

      forkArgs.push(`--kt-process-preload=${preloadPath}`);
      forkArgs.push(`--kt-process-sockpath=${this.getExtServerListenPath(clientId)}`);
      extProcessPath = (process.env.EXT_MODE === 'js' ? path.join(__dirname, '../../lib/hosted/ext.process.js') : path.join(__dirname, '../hosted/ext.process' + path.extname(module.filename)));
    }

    console.log('extProcessPath', extProcessPath);

    console.time(`${clientId} fork ext process`);
    const extProcess = cp.fork(extProcessPath, forkArgs, forkOptions);
    this.logger.debug('extProcess.pid', extProcess.pid);

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

  // 待废弃
  // FIXME: 增加插件启动状态来标识当前后台插件进程情况
  public async createProcess() {
    // TODO 去除preload功能, 现在不需要了
    const preloadPath = path.join(__dirname, '../hosted/ext.host' + path.extname(__filename));
    const forkOptions: cp.ForkOptions =  {};
    const forkArgs: string[] = [];
    forkOptions.execArgv = [];

    // ts-node模式
    if (module.filename.endsWith('.ts')) {
      forkOptions.execArgv = forkOptions.execArgv.concat(['-r', 'ts-node/register', '-r', 'tsconfig-paths/register']);
    }
    if (isDevelopment()) {
      forkOptions.execArgv.push('--inspect=9889');
    }

    forkArgs.push(`--kt-process-preload=${preloadPath}`);
    forkArgs.push(`--kt-process-sockpath=${this.getExtServerListenPath(MOCK_CLIENT_ID)}`);

    const extProcessPath = process.env.EXTENSION_HOST_ENTRY ||  path.join(__dirname, '../hosted/ext.process' + path.extname(__filename));
    const extProcess = cp.fork(extProcessPath, forkArgs, forkOptions);
    this.extProcess = extProcess;

    /*

    const initDeferred = new Deferred<void>();
    this.initDeferred = initDeferred;

    const initHandler = (msg) => {
      if (msg === 'ready') {
        initDeferred.resolve();
        extProcess.removeListener('message', initHandler);
      }
    };
    extProcess.on('message', initHandler);

    await this._getExtHostConnection(MOCK_CLIENT_ID);
    */
    this.connectionDeffered = new Deferred();

    /*
    this._getMainThreadConnection(MOCK_CLIENT_ID).then((mainThreadConnection) => {
      const extConnection = this.extConnection;
      // @ts-ignore
      mainThreadConnection.reader.listen((input) => {
        // @ts-ignore
        extConnection.writer.write(input);
      });
      // @ts-ignore
      extConnection.reader.listen((input) => {
        // @ts-ignore
        mainThreadConnection.writer.write(input);
      });

      this.connectionDeffered.resolve();
    });
    */

  }
  private async _setMainThreadConnection(handler) {

    if (process.env.KTELECTRON) {
      const clientId = process.env.CODE_WINDOW_CLIENT_ID as string;
      const mainThreadServer: net.Server = net.createServer();
      this.electronMainThreadServer = mainThreadServer;
      const mainThreadListenPath = this.getElectronMainThreadListenPath2(clientId);
      console.log('mainThreadListenPath', mainThreadListenPath);

      try {
        await fs.unlink(mainThreadListenPath);
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
          });
          // TODO: 处理进程 threshold 逻辑，可以让进程重连
        },
        dispose: (connection, connectionClientId) => {
          // FIXME: 暂时先不杀掉
          // this.disposeClientExtProcess(connectionClientId);
        },
      });
    }
  }
  private async disposeClientExtProcess(clientId: string) {

    if (this.clientExtProcessMap.has(clientId)) {
      const extProcess = this.clientExtProcessMap.get(clientId) as cp.ChildProcess;
      extProcess.send('close');

      // deactive
      // subscription
      await (this.clientExtProcessFinishDeferredMap.get(clientId) as Deferred<void>).promise;

      // extServer 关闭
      await (this.clientExtProcessExtConnectionServer.get(clientId) as net.Server).close();

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

      // kill
      extProcess.kill();
      this.logger.log(`${clientId} extProcess dispose`);
    }
  }
  // 待废弃
  private async _getMainThreadConnection(clientId: string) {
    if (process.env.KTELECTRON) {
      const server: net.Server = net.createServer();
      this.electronMainThreadServer = server;
      const listenPath = this.getElectronMainThreadListenPath(clientId);
      try {
        await fs.unlink(listenPath);
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
      await fs.unlink(extServerListenPath);
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
      await fs.unlink(extServerListenPath);
    } catch (e) { }

    const extConnection =  await new Promise((resolve) => {
      extServer.on('connection', (connection) => {
        getLogger().log('kaitian _getExtHostConnection2 ext host connected');

        const connectionObj = {
          reader: new SocketMessageReader(connection),
          writer: new SocketMessageWriter(connection),
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
