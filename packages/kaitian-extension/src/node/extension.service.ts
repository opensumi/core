import * as path from 'path';
import * as os from 'os';
import * as net from 'net';
import * as fs from 'fs-extra';
import { Injectable } from '@ali/common-di';
import { ExtensionScanner } from './extension.scanner';
import { IExtensionMetaData, IExtensionNodeService, ExtraMetaData } from '../common';
import { getLogger, Deferred, isDevelopment } from '@ali/ide-core-node';
import * as cp from 'child_process';

import {
  commonChannelPathHandler,

  SocketMessageReader,
  SocketMessageWriter,

  WebSocketMessageReader,
  WebSocketMessageWriter,
} from '@ali/ide-connection';

const MOCK_CLIENT_ID = 'MOCK_CLIENT_ID';

@Injectable()
export class ExtensionNodeServiceImpl implements IExtensionNodeService  {

  private extProcess: cp.ChildProcess;
  private extProcessClientId: string;

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
    return path.join(os.homedir(), `.kt_${clientId}_sock`);
  }
  public getElectronMainThreadListenPath(clientId: string): string {
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

  public async preCreateProcess() {

    const preloadPath = process.env.EXT_MODE === 'js' ? path.join(__dirname, '../../lib/hosted/ext.host.js') : path.join(__dirname, '../hosted/ext.host' + path.extname(module.filename));
    const forkOptions: cp.ForkOptions =  {};
    const forkArgs: string[] = [];
    forkOptions.execArgv = [];

    // ts-node模式
    if (process.env.EXT_MODE !== 'js' && module.filename.endsWith('.ts')) {
      forkOptions.execArgv = forkOptions.execArgv.concat(['-r', 'ts-node/register', '-r', 'tsconfig-paths/register']);
    }

    if (isDevelopment()) {
      forkOptions.execArgv.push('--inspect=9889');
    }

    forkArgs.push(`--kt-process-preload=${preloadPath}`);
    forkArgs.push(`--kt-process-sockpath=${this.getExtServerListenPath(MOCK_CLIENT_ID)}`);

    const extProcessPath = process.env.EXT_MODE === 'js' ? path.join(__dirname, '../../lib/hosted/ext.process.js') : path.join(__dirname, '../hosted/ext.process' + path.extname(module.filename));
    console.time('fork ext process');
    console.log('extProcessPath', extProcessPath);
    const extProcess = cp.fork(extProcessPath, forkArgs, forkOptions);

    this.extProcess = extProcess;

    const initDeferred = new Deferred<void>();
    this.initDeferred = initDeferred;

    const initHandler = (msg) => {
      if (msg === 'ready') {
        console.timeEnd('fork ext process');
        initDeferred.resolve();
        extProcess.removeListener('message', initHandler);
      }
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

  // FIXME: 增加插件启动状态来标识当前后台插件进程情况
  public async createProcess() {
    /*
    const preloadPath = path.join(__dirname, '../hosted/ext.host' + path.extname(module.filename));
    const forkOptions: cp.ForkOptions =  {};
    const forkArgs: string[] = [];
    forkOptions.execArgv = []

    // ts-node模式
    if (module.filename.endsWith('.ts')) {
      forkOptions.execArgv = forkOptions.execArgv.concat(['-r', 'ts-node/register', '-r', 'tsconfig-paths/register'])
    }
    if (isDevelopment()) {
      forkOptions.execArgv.push('--inspect=9889');
    }

    forkArgs.push(`--kt-process-preload=${preloadPath}`);
    forkArgs.push(`--kt-process-sockpath=${this.getExtServerListenPath(MOCK_CLIENT_ID)}`);

    const extProcessPath = path.join(__dirname, '../hosted/ext.process' + path.extname(module.filename));
    const extProcess = cp.fork(extProcessPath, forkArgs, forkOptions);
    this.extProcess = extProcess;
    */
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
    commonChannelPathHandler.register('ExtMainThreadConnection', {
      handler: (connection, connectionClientId: string) => {
        getLogger().log('kaitian pre ext main connected');

        handler({
          connection: {
            reader: new WebSocketMessageReader(connection),
            writer: new WebSocketMessageWriter(connection),
          },
          clientId: connectionClientId,
        });

      },

      // TODO: dispose 关联 connectionId
      // TODO: 刷新流程
      dispose: (connection, connectionClientId) => {
        // TODO: dispose clientId
        if (this.extProcessClientId === connectionClientId) {

        }
      },
    });
  }
  // TODO: 增加 map 管理接收的进程连接
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

  private async _getExtHostConnection(clientId: string) {
    const extServerListenPath = this.getExtServerListenPath(clientId);
    const extServer = net.createServer();

    try {
      await fs.unlink(extServerListenPath);
    } catch (e) {}

    const extConnection =  await new Promise((resolve) => {
      extServer.on('connection', (connection) => {
        getLogger().log('kaitian ext host connected');

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
}
