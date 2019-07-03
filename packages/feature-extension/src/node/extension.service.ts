import { ExtensionNodeService, IExtensionCandidate } from '../common';
import { Injectable } from '@ali/common-di';
import { join, resolve } from 'path';
import { homedir } from 'os';
import { readdir, pathExists, readJSON, readFile } from 'fs-extra';
import { getLogger } from '@ali/ide-core-node';
import * as cp from 'child_process';
import * as net from 'net';
import * as fs from 'fs-extra';
import * as path from 'path';

import {
  commonChannelPathHandler,

  SocketMessageReader,
  SocketMessageWriter,

  WebSocketMessageReader,
  WebSocketMessageWriter,
} from '@ali/ide-connection';

interface IExtConnection {
  reader: any;
  writer: any;
}

@Injectable()
export class ExtensionNodeServiceImpl implements ExtensionNodeService {

  private processMap: Map<string, cp.ChildProcess> = new Map();
  private processServerMap: Map<string, net.Server> = new Map();

  async getAllCandidatesFromFileSystem(scan: string[], candidates: string[], extraMetaData: {[key: string]: string; }): Promise<IExtensionCandidate[]> {
    return new ExtensionScanner(scan, candidates, extraMetaData).run();
  }
  getExtServerListenPath(name: string): string {
    return path.join(homedir(), `.kt_${name}_sock`);
  }
  private async _getMainThreadConnection(name: string = 'ExtProtocol'): Promise<IExtConnection> {
    return await new Promise((resolve) => {
      const channelHandler = {
        handler: (connection) => {
          getLogger().log('ext main connected');

          resolve({
            reader: new WebSocketMessageReader(connection),
            writer: new WebSocketMessageWriter(connection),
          });
        },
        dispose: () => {
          console.log('remove _getMainThreadConnection handler');
          this._disposeConnection(name);
          commonChannelPathHandler.removeHandler(name, channelHandler);
        },
      };
      commonChannelPathHandler.register(name, channelHandler);
    });

  }
  private async _disposeConnection(name) {

    if (this.processMap.has(name)) {
      const process = this.processMap.get(name) as cp.ChildProcess;
      process.kill();
      getLogger().log(`ext ${name} connected killed`);
    }
    if (this.processServerMap.has(name)) {
      const server = this.processServerMap.get(name) as net.Server;
      server.close();
    }
  }
  private async _getExtHostConnection(name): Promise<IExtConnection> {
    const extServerListenPath = this.getExtServerListenPath(name);
    const extServer = net.createServer();

    try {
      await fs.unlink(extServerListenPath);
    } catch (e) {}

    return await new Promise((resolve) => {
      extServer.on('connection', (connection) => {
        getLogger().log('ext host connected');

        resolve({
          reader: new SocketMessageReader(connection),
          writer: new SocketMessageWriter(connection),
        });
      });
      extServer.listen(extServerListenPath, () => {
        getLogger().log(`ext server listen on ${extServerListenPath}`);
      });

      this.processServerMap.set(name, extServer);
    });
  }
  private async _forwardConnection(name: string = 'ExtProtocol') {
    const [mainThreadConnection, extConnection] = await Promise.all([this._getMainThreadConnection(name), this._getExtHostConnection(name)]);
    mainThreadConnection.reader.listen((input) => {
      extConnection.writer.write(input);
    });
    extConnection.reader.listen((input) => {
      mainThreadConnection.writer.write(input);
    });
  }

  public async createExtProcess() {
    const forkOptions = {
      env: process.env,
      execArgv: ['--inspect=9992'],
    };
    const extProcess = cp.fork(join(__dirname, '../../lib/node/ext.host.js'), [], forkOptions);
    console.log('extPath', join(__dirname, '../../lib/node/ext.host.js'));
    extProcess.on('error', (e) => {
      console.log('extProcess error', e);
    });
    extProcess.on('exit', (e) => {
      console.log('extProcess exit', e);
    });
    // this._forwardConnection();
  }

  public createProcess(name: string, preload: string, args: string[] = [], options?: cp.ForkOptions) {
    const forkOptions = options || {};
    const forkArgs = args || [];
    forkArgs.push(`--kt-process-preload=${preload}`);
    forkArgs.push(`--kt-process-sockpath=${this.getExtServerListenPath(name)}`);
    const extProcess = cp.fork(join(__dirname, '../../lib/node/ext.process.js'), forkArgs, forkOptions);
    this.processMap.set(name, extProcess);
    this._forwardConnection(name);
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
        return join(homedir(), path.slice(1));
    }
    return path;
}
