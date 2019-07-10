import { Disposable, getLogger } from '@ali/ide-core-common';
import { Injectable, Autowired } from '@ali/common-di';
import { ElectronAppConfig } from './types';
import { BrowserWindow } from 'electron';
import { ChildProcess, fork, ForkOptions } from 'child_process';
import { join } from 'path';

@Injectable({multiple: true})
export class CodeWindow extends Disposable {

  private _workspace: string | undefined;

  @Autowired(ElectronAppConfig)
  private appConfig: ElectronAppConfig;

  private browser: BrowserWindow;

  private node: KTNodeProcess;

  constructor(workspace?: string) {
    super();
    this._workspace = workspace;
    this.browser = new BrowserWindow({
      show: false,
      webPreferences: {
        nodeIntegration: false,
        preload: join(__dirname, '../../browser-preload/index.js'),
      },
    });
  }

  get workspace() {
    return this._workspace;
  }

  async start() {
    this.clear();
    try {
      this.node = new KTNodeProcess(this.appConfig.nodeEntry);
      await this.node.start();
      getLogger().log('starting browser window with url: ', this.appConfig.browserUrl);
      this.browser.loadURL(this.appConfig.browserUrl);
      this.browser.show();
    } catch (e) {
      getLogger().error(e);
    }
  }

  clear() {
    if (this.node) {
      // TODO Dispose
    }
  }

}

export class KTNodeProcess {

  private _process: ChildProcess;

  private ready: Promise<void>;

  constructor(private forkPath) {

  }

  async start() {
    if (!this.ready) {
      this.ready = new Promise((resolve, reject) => {
        try {
          const forkOptions: ForkOptions = {
            env: { ... process.env},
            stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
          };
          const forkArgs = [];
          if (module.filename.endsWith('.ts')) {
            forkOptions.execArgv = ['-r', 'ts-node/register', '-r', 'tsconfig-paths/register']; // ts-node模式
          }
          this._process = fork(this.forkPath, forkArgs, forkOptions);
          this._process.on('message', (message) => {
            console.log(message);
            if (message === 'ready') {
              resolve();
            }
          });
          this._process.on('error', (error) => {
            reject(error);
          });
          this._process.stdout.on('data', (data) => {
            getLogger().log('[node]' + data );
          });
          this._process.stderr.on('data', (data) => {
            getLogger().error('[node]' + data );
          });
        } catch (e) {
          reject(e);
        }
      });
    }
    return this.ready;

  }

  get process() {
    return this._process;
  }
}
