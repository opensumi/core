import { ExtensionNodeService, IExtensionCandidate } from '../common';
import { Injectable } from '@ali/common-di';
import { join, resolve } from 'path';
import { homedir } from 'os';
import { readdir, pathExists, readJSON, readFile } from 'fs-extra';
import { getLogger } from '@ali/ide-core-node';
import * as cp from 'child_process';
import * as net from 'net';
import * as path from 'path';
import {
  pathHandler,

  SocketMessageReader,
  SocketMessageWriter,

  WebSocketMessageReader,
  WebSocketMessageWriter,
} from '@ali/ide-connection';

interface IExtConnection {
  reader: any;
  writer: any;
}

export const extServerListenPath = path.join(__dirname, 'extsock');
@Injectable()
export class ExtensionNodeServiceImpl implements ExtensionNodeService {

  async getAllCandidatesFromFileSystem(scan: string[], candidates: string[], extraMetaData: {[key: string]: string; }): Promise<IExtensionCandidate[]> {
    return new ExtensionScanner(scan, candidates, extraMetaData).run();
  }
  async getExtServerListenPath() {
    return extServerListenPath;
  }
  private async _getMainThreadConnection(): Promise<IExtConnection> {
    return await new Promise((resolve) => {
      pathHandler.set('ExtProtocol', [(connection) => {
        getLogger().log('ext main connected');

        resolve({
          reader: new WebSocketMessageReader(connection),
          writer: new WebSocketMessageWriter(connection),
        });
      }]);
    });
  }
  private async _getExtHostConnection(): Promise<IExtConnection> {
    return await new Promise((resolve) => {
      const extServer = net.createServer();
      extServer.on('connection', (connection) => {
        resolve({
          reader: new SocketMessageReader(connection),
          writer: new SocketMessageWriter(connection),
        });
      });
      extServer.listen(extServerListenPath, () => {
        getLogger().log(`ext server listen on ${extServerListenPath}`);
      });
    });
  }
  private async _forwardConnection() {
    const [mainThreadConnection, extConnection] = await Promise.all([this._getMainThreadConnection(), this._getExtHostConnection()]);
    mainThreadConnection.reader.listen((input) => {
      extConnection.writer.write(input);
    });
    extConnection.reader.listn((input) => {
      mainThreadConnection.writer.write(input);
    });
  }
  public async createExtProcess() {
    const forkOptions = {
      env: process.env,
    };
    const extProcess = cp.fork(join(__dirname, '../../lib/node/ext.host.js'));
    this._forwardConnection();
  }
}

export class ExtensionScanner {

  private results: Map<string, IExtensionCandidate> = new Map();

  constructor(private scan: string[], private candidates: string[], private extraMetaData: {[key: string]: string; }) {

  }

  async run(): Promise<IExtensionCandidate[]> {
    await Promise.all(this.scan.map((dir) => this.scanDir(resolvePath(dir)))
    .concat(this.candidates.map((c) => this.getCandidate(resolvePath(c)))));
    return Array.from(this.results.values());
  }

  private async scanDir(dir: string): Promise<void> {
    try {
      const candidates: IExtensionCandidate[] = [];
      const files = await readdir(dir);
      await Promise.all(files.map((file) => {
        const path = join(dir, file);
        return this.getCandidate(path);
      }));
    } catch (e) {
      getLogger().error(e);
    }
  }

  private async getCandidate(path: string): Promise<void> {

    if (this.results.has(path)) {
      return;
    }

    if (!await pathExists(join(path, 'package.json'))) {
      return;
    } else {
      try {
        const packageJSON = await readJSON(join(path, 'package.json'));
        const extraMetaData = {};
        for (const extraField of Object.keys(this.extraMetaData)) {
          try {
            extraMetaData[extraField] = (await readFile(join(path, this.extraMetaData[extraField]))).toString();
          } catch (e) {
            extraMetaData[extraField] = null;
          }
        }
        this.results.set(path, {
          path,
          packageJSON,
          extraMetaData,
        });
      } catch (e) {
        getLogger().error(e);
        return;
      }
    }
  }

}
function resolvePath(path) {
    if (path[0] === '~') {
        return path.join(homedir(), path.slice(1));
    }
    return path;
}
