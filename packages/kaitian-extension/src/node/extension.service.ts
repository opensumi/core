import * as path from 'path';
import * as os from 'os';
import * as net from 'net';
import * as fs from 'fs-extra';
import { Injectable } from '@ali/common-di';
import { ExtensionScanner } from './extension.scanner';
import { IExtensionMetaData, ExtensionNodeService } from '../common';
import { getLogger, Deferred } from '@ali/ide-core-node';
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
export class ExtensionNodeServiceImpl implements ExtensionNodeService  {
  private extProcess: cp.ChildProcess;
  private extServer: net.Server;
  private extConnection;

  public async getAllExtensions(scan: string[], extenionCandidate: string[], extraMetaData: {[key: string]: any}): Promise<IExtensionMetaData[]> {
    return new ExtensionScanner(scan, extenionCandidate, extraMetaData).run();
  }
  public getExtServerListenPath(clientId: string): string {
    return path.join(os.homedir(), `.kt_${clientId}_sock`);
  }
  public async createProcess(preload: string, forkArgs: string[] = [], options?: cp.ForkOptions) {
    const forkOptions = options || {};

    if (module.filename.endsWith('.ts')) {
      forkOptions.execArgv = ['-r', 'ts-node/register', '-r', 'tsconfig-paths/register'];
    }
    forkArgs.push(`--kt-process-preload=${preload}`);
    forkArgs.push(`--kt-process-sockpath=${this.getExtServerListenPath(MOCK_CLIENT_ID)}`);

    const extProcessPath = path.join(__dirname, './hosted/ext.process' + path.extname(module.filename));
    const extProcess = cp.fork(extProcessPath, forkArgs, forkOptions);
    this.extProcess = extProcess;

    await this._getExtHostConnection(MOCK_CLIENT_ID);

  }

  private async _getExtHostConnection(clientId: string) {
    const extServerListenPath = this.getExtServerListenPath(clientId);
    const extServer = net.createServer();

    try {
      await fs.unlink(extServerListenPath);
    } catch (e) {}

    const extConnection =  await new Promise((resolve) => {
      extServer.on('connection', (connection) => {
        getLogger().log('ext host connected');

        const connectionObj = {
          reader: new SocketMessageReader(connection),
          writer: new SocketMessageWriter(connection),
        };
        this.extConnection = connectionObj;
        resolve(connectionObj);
      });
      extServer.listen(extServerListenPath, () => {
        getLogger().log(`ext server listen on ${extServerListenPath}`);
      });
      this.extServer = extServer;

      // this.processServerMap.set(name, extServer);
    });

    return extConnection;
  }
}
