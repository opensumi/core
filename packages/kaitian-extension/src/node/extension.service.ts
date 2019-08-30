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
  private extServer: net.Server;
  private electronMainThreadServer: net.Server;
  private extConnection;
  private connectionDeffered: Deferred<void>;
  private initDeferred: Deferred<void>;
  private clientId;
  private extensionScanner: ExtensionScanner;

  public async getAllExtensions(scan: string[], extenionCandidate: string[], extraMetaData: {[key: string]: any}): Promise<IExtensionMetaData[]> {
    this.extensionScanner = new ExtensionScanner(scan, extenionCandidate, extraMetaData);
    return this.extensionScanner.run();
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

  public async createProcess() {
    const preloadPath = path.join(__dirname, '../hosted/ext.host' + path.extname(module.filename));
    const forkOptions: cp.ForkOptions =  {};
    const forkArgs: string[] = [];

    if (module.filename.endsWith('.ts')) {
      if (isDevelopment()) {
        forkOptions.execArgv = ['-r', 'ts-node/register', '-r', 'tsconfig-paths/register', '--inspect=9889']; // ts-node模式
      }
    }

    forkArgs.push(`--kt-process-preload=${preloadPath}`);
    forkArgs.push(`--kt-process-sockpath=${this.getExtServerListenPath(MOCK_CLIENT_ID)}`);

    const extProcessPath = path.join(__dirname, '../hosted/ext.process' + path.extname(module.filename));
    const extProcess = cp.fork(extProcessPath, forkArgs, forkOptions);
    this.extProcess = extProcess;

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
    this.connectionDeffered = new Deferred();

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

  }

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
          handler: (connection) => {
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
