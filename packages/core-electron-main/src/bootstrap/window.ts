import { Disposable } from '@ali/ide-core-common';
import { Injectable, Autowired } from '@ali/common-di';
import { ElectronAppConfig } from './types';
import { BrowserWindow } from 'electron';
import { ChildProcess, fork, ForkOptions } from 'child_process';
import { rejects } from 'assert';

@Injectable({multiple: true})
export class CodeWindow extends Disposable {

  private _workspace: string | undefined;

  @Autowired()
  private appConfig: ElectronAppConfig;

  private browser: BrowserWindow;

  private node: KTNodeProcess;

  constructor(workspace?: string) {
    super();
    this._workspace = workspace;
    this.browser = new BrowserWindow();
  }

  get workspace() {
    return this._workspace;
  }

  async start() {
    this.clear();
    this.node = new KTNodeProcess(this.appConfig.nodeEntry);
    await this.node.start();
    this.browser.loadURL(this.appConfig.browserUrl);
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
      this.ready = new Promise((resolve) => {
        try {
          const forkOptions: ForkOptions = {env: process.env};
          const forkArgs = [];
          if (module.filename.endsWith('.ts')) {
            forkOptions.execArgv = ['-r', 'ts-node/register', '-r', 'tsconfig-paths/register']; // ts-node模式
          }
          this._process = fork(this.forkPath, forkArgs, forkOptions);
          resolve();
        } catch (e) {
          rejects(e);
        }
      });
    }
    return this.ready;

  }

  get process() {
    return this._process;
  }
}
