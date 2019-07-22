import { ExtensionNodeService, IExtensionCandidate } from '../common';
import { Injectable } from '@ali/common-di';
import { join, resolve } from 'path';
import { homedir } from 'os';
import { readdir, pathExists, readJSON, readFile } from 'fs-extra';
import { getLogger, Deferred } from '@ali/ide-core-node';
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
  private processConnectionMap: Map<string, IExtConnection> = new Map();
  private connectionDeferredMap: Map<string, Deferred<void>> = new Map();
  private initDefferredMap: Map<string, Deferred<void>> = new Map();

  private electronNetServerMap: Map<string, net.Server > = new Map();

  async getAllCandidatesFromFileSystem(scan: string[], candidates: string[], extraMetaData: {[key: string]: string; }): Promise<IExtensionCandidate[]> {
    return new ExtensionScanner(scan, candidates, extraMetaData).run();
  }

  getExtServerListenPath(name: string): string {
    return path.join(homedir(), `.kt_${name}_sock`);
  }
  getElectronMainThreadListenPath(name: string): string {
    return path.join(homedir(), `.kt_electron_main_thread_${name}_sock`);
  }
  private async _createElectronNetMainThreadConnection(name: string): Promise<IExtConnection> {
    let server: net.Server;

    if (!this.electronNetServerMap.has(name)) {
      server = net.createServer();
      const listenPath = this.getElectronMainThreadListenPath(name);

      try {
        await fs.unlink(listenPath);
      } catch (e) {
        console.log('_createElectronNetMainThreadConnection', e);
      }
      await new Promise((resolve) => {
        server.listen(listenPath, () => {
          console.log(`electron mainThread listen on ${listenPath}`);
          resolve();
        });
      });
      this.electronNetServerMap.set(name, server);
    } else {
      server = this.electronNetServerMap.get(name) as net.Server;
    }

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
          this._disposeConnection(name);
        });
      };

      server.on('connection', connectionHandler);
    });

  }
  public _getMainThreadConnection(name: string = 'ExtProtocol'): Promise<IExtConnection> {
    if (process.env.KTELECTRON) {
      return this._createElectronNetMainThreadConnection(name);
    } else {
      return new Promise((resolve) => {
        const channelHandler = {
          handler: (connection) => {
            getLogger().log('ext main connected');

            resolve({
              reader: new WebSocketMessageReader(connection),
              writer: new WebSocketMessageWriter(connection),
            });
          },
          dispose: () => {
            getLogger().log('remove _getMainThreadConnection handler');
            this._disposeConnection(name);
            commonChannelPathHandler.removeHandler(name, channelHandler);
          },
        };
        commonChannelPathHandler.register(name, channelHandler);
      });
    }
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
      this.processServerMap.delete(name);
    }
    if (this.processConnectionMap.has(name)) {
      this.processConnectionMap.delete(name);
    }
    if (this.electronNetServerMap.has(name)) {
      const server = this.electronNetServerMap.get(name) as net.Server;
      server.close();
      this.electronNetServerMap.delete(name);
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

        const connectionObj = {
          reader: new SocketMessageReader(connection),
          writer: new SocketMessageWriter(connection),
        };
        resolve(connectionObj);

        this.processConnectionMap.set(name, connectionObj);
      });
      extServer.listen(extServerListenPath, () => {
        getLogger().log(`ext server listen on ${extServerListenPath}`);
      });

      this.processServerMap.set(name, extServer);
    });
  }
  private async _forwardConnection(name: string = 'ExtProtocol') {

    const p1 = this._getMainThreadConnection(name);
    const p2 = this._getExtHostConnection(name);

    const [mainThreadConnection, extConnection] = await Promise.all([p1, p2]);
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
  }
  public async createProcess(name: string, preload: string, args: string[] = [], options?: cp.ForkOptions) {
    const forkOptions = options || {};
    const forkArgs = args || [];
    if (module.filename.endsWith('.ts')) {
      forkOptions.execArgv = ['-r', 'ts-node/register', '-r', 'tsconfig-paths/register']; // ts-node模式
    }
    forkArgs.push(`--kt-process-preload=${preload}`);
    forkArgs.push(`--kt-process-sockpath=${this.getExtServerListenPath(name)}`);
    let extProcessPath;
    extProcessPath = join(__dirname, './ext.process' + path.extname(module.filename));
    const extProcess = cp.fork(extProcessPath, forkArgs, forkOptions);
    const initDeferred = new Deferred<void>();
    this.initDefferredMap.set(name, initDeferred);
    const initHandler = (msg) => {
      if (msg === 'ready') {
        initDeferred.resolve();
        extProcess.removeListener('message', initHandler);
      }
    };
    extProcess.on('message', initHandler);
    this.processMap.set(name, extProcess);
    // this._forwardConnection(name);
    await this._getExtHostConnection(name);

    this.connectionDeferredMap.set(name, new Deferred());

    this._getMainThreadConnection(name).then((mainThreadConnection: IExtConnection) => {
      if (this.processConnectionMap.has(name)) {
        const extConnection = this.processConnectionMap.get(name);
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

        console.log('connectionDeferredMap', this.connectionDeferredMap.get(name));
        this.connectionDeferredMap.get(name)!.resolve();
      }
    });
  }

  public async resolveConnection(name: string) {
    if ( this.connectionDeferredMap.has(name)) {
      await this.connectionDeferredMap.get(name)!.promise;
    } else {
      console.log(`name ${name} connection not found resolve`);
    }

  }
  public async resolveProcessInit(name: string) {
    if (this.initDefferredMap.has(name)) {
      await this.initDefferredMap.get(name)!.promise;
    } else {
      console.log(`name ${name} process init defferred not found resolve`);
    }
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
    if (path[0] === '$') {
      return join(frameworkDir(), path.slice(1));
    }
    if (path[0] === '^') {
      return join(process.cwd(), path.slice(1));
    }
    // TODO
    return path;
}

function frameworkDir() {
  return join(__dirname, '../../../../');
}
