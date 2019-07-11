import { Disposable, getLogger, uuid } from '@ali/ide-core-common';
import { Injectable, Autowired } from '@ali/common-di';
import { ElectronAppConfig, ICodeWindow } from './types';
import { BrowserWindow, shell } from 'electron';
import { ChildProcess, fork, ForkOptions } from 'child_process';
import { join } from 'path';
import * as os from 'os';

@Injectable({multiple: true})
export class CodeWindow extends Disposable implements ICodeWindow {

  private _workspace: string | undefined;

  @Autowired(ElectronAppConfig)
  private appConfig: ElectronAppConfig;

  private browser: BrowserWindow;

  private node: KTNodeProcess | null = null;

  constructor(workspace?: string) {
    super();
    this._workspace = workspace;
    this.browser = new BrowserWindow({
      show: false,
      webPreferences: {
        nodeIntegration: this.appConfig.browserNodeIntegrated,
        preload: join(__dirname, '../../browser-preload/index.js'),
      },
    });
    this.browser.on('closed', () => {
      this.dispose();
    });

  }

  get workspace() {
    return this._workspace;
  }

  async start() {
    this.clear();
    try {
      this.node = new KTNodeProcess(this.appConfig.nodeEntry);
      const listenPath = join(os.tmpdir(), `${uuid()}.sock`);

      await this.node.start(listenPath);
      getLogger().log('starting browser window with url: ', this.appConfig.browserUrl);
      this.browser.loadURL(this.appConfig.browserUrl);
      this.browser.show();
      this.browser.webContents.on('did-finish-load', () => {
        this.browser.webContents.send('preload:listenPath', listenPath);
      });
      this.bindEvents();
    } catch (e) {
      getLogger().error(e);
    }
  }

  bindEvents() {
    // 外部打开http
    this.browser.webContents.on('new-window',
      (event, url) => {
        if (!event.defaultPrevented) {
          event.preventDefault();
          if (url.indexOf('http') === 0) {
            shell.openExternal(url);
          }
        }
    });
  }

  clear() {
    if (this.node) {
      // TODO Dispose
      this.node.dispose();
      this.node = null;
    }
  }

  dispose() {
    this.clear();
    super.dispose();
  }

  getBrowserWindow() {
    return this.browser;
  }
}

export class KTNodeProcess {

  private _process: ChildProcess;

  private ready: Promise<void>;

  constructor(private forkPath) {

  }

  async start(listenPath: string) {

    if (!this.ready) {
      this.ready = new Promise((resolve, reject) => {
        try {
          const forkOptions: ForkOptions = {
            env: { ... process.env},
            stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
          };
          const forkArgs: string[] = [];
          if (module.filename.endsWith('.ts')) {
            forkOptions.execArgv = ['-r', 'ts-node/register', '-r', 'tsconfig-paths/register']; // ts-node模式
          }
          forkArgs.push('--listenPath', listenPath);
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

  dispose() {
    if (this._process) {
      this._process.kill();
    }
  }
}
