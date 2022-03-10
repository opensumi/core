import { ChildProcess, fork, ForkOptions } from 'child_process';
import qs from 'querystring';

import { app, BrowserWindow, shell, ipcMain, BrowserWindowConstructorOptions, IpcMainEvent } from 'electron';
import semver from 'semver';
import treeKill from 'tree-kill';


import { Injectable, Autowired } from '@opensumi/di';
import { ExtensionCandidate } from '@opensumi/ide-core-common';
import { Disposable, getDebugLogger, isOSX, URI, FileUri, Deferred } from '@opensumi/ide-core-common';
import { normalizedIpcHandlerPath } from '@opensumi/ide-core-common/lib/utils/ipc';

import { ElectronAppConfig, ICodeWindow, ICodeWindowOptions } from './types';

const DEFAULT_WINDOW_HEIGHT = 700;
const DEFAULT_WINDOW_WIDTH = 1000;

let windowClientCount = 0;

const defaultWebPreferences = {
  webviewTag: true,
  contextIsolation: false,
};

@Injectable({ multiple: true })
export class CodeWindow extends Disposable implements ICodeWindow {
  private _workspace: URI | undefined;

  @Autowired(ElectronAppConfig)
  private appConfig: ElectronAppConfig;

  private extensionDir: string;

  private extensionCandidate: ExtensionCandidate[] = [];

  private query: qs.ParsedUrlQuery;

  private browser: BrowserWindow;

  private node: KTNodeProcess | null = null;

  private windowClientId: string;

  public isRemote = false;

  public isReloading: boolean;

  public metadata: any;

  private _nodeReady = new Deferred<void>();

  private rpcListenPath: string | undefined = undefined;

  constructor(workspace?: string, metadata?: any, options: BrowserWindowConstructorOptions & ICodeWindowOptions = {}) {
    super();
    this.extensionDir = this.appConfig.extensionDir;
    if (workspace) {
      this._workspace = new URI(workspace);
    }
    this.metadata = metadata;
    this.windowClientId = 'CODE_WINDOW_CLIENT_ID:' + ++windowClientCount;

    this.browser = new BrowserWindow({
      show: false,
      webPreferences: {
        ...defaultWebPreferences,
        ...this.appConfig?.overrideWebPreferences,
        nodeIntegration: this.appConfig?.browserNodeIntegrated,
        preload: this.appConfig?.browserPreload,
      },
      frame: isOSX,
      titleBarStyle: 'hidden',
      height: DEFAULT_WINDOW_HEIGHT,
      width: DEFAULT_WINDOW_WIDTH,
      ...this.appConfig.overrideBrowserOptions,
      ...options,
    });
    if (options) {
      if (options.extensionDir) {
        this.extensionDir = options.extensionDir;
      }

      if (options.extensionCandidate) {
        this.extensionCandidate = options.extensionCandidate;
      }

      if (options.query) {
        this.query = options.query;
      }

      if (options.isRemote) {
        this.isRemote = options.isRemote;
      }
    }

    this.browser.on('closed', () => {
      this.dispose();
    });
    const metadataResponser = async (event: IpcMainEvent, windowId: number) => {
      if (windowId === this.browser.id) {
        event.returnValue = JSON.stringify({
          workspace: this.workspace ? FileUri.fsPath(this.workspace) : undefined,
          webview: {
            webviewPreload: URI.file(this.appConfig.webviewPreload).toString(),
            plainWebviewPreload: URI.file(this.appConfig.plainWebviewPreload).toString(),
          },
          extensionDir: this.extensionDir,
          extensionCandidate: this.appConfig.extensionCandidate.concat(this.extensionCandidate).filter(Boolean),
          ...this.metadata,
          isRemote: this.isRemote,
          windowClientId: this.windowClientId,
          workerHostEntry: this.appConfig.extensionWorkerEntry,
          extensionDevelopmentHost: this.appConfig.extensionDevelopmentHost,
          appPath: app.getAppPath(),
        });
      }
    };

    const rpcListenPathResponser = async (event: IpcMainEvent, windowId: number) => {
      await this._nodeReady.promise;
      if (windowId === this.browser.id) {
        event.returnValue = this.rpcListenPath;
      }
    };
    ipcMain.on('window-metadata', metadataResponser);
    ipcMain.on('window-rpc-listen-path', rpcListenPathResponser);
    this.addDispose({
      dispose: () => {
        ipcMain.removeListener('window-metadata', metadataResponser);
        ipcMain.removeListener('window-rpc-listen-path', rpcListenPathResponser);
      },
    });
  }

  get workspace() {
    return this._workspace;
  }

  setWorkspace(workspace: string, fsPath?: boolean) {
    if (fsPath) {
      this._workspace = URI.file(workspace);
    } else {
      this._workspace = new URI(workspace);
    }
  }

  setExtensionDir(extensionDir: string) {
    this.extensionDir = URI.file(extensionDir).toString();
  }

  setExtensionCandidate(extensionCandidate: ExtensionCandidate[]) {
    this.extensionCandidate = extensionCandidate;
  }

  async start() {
    if (this.isRemote) {
      getDebugLogger().log('Remote 模式，停止创建 Server 进程');
    } else {
      this.startNode();
    }

    try {
      getDebugLogger().log('starting browser window with url: ', this.appConfig.browserUrl);

      const browserUrlParsed = URI.parse(this.appConfig.browserUrl);
      const queryString = qs.stringify({
        ...qs.parse(browserUrlParsed.query),
        ...this.query,
        windowId: this.browser.id,
        webContentsId: this.browser.webContents.id,
      });
      const browserUrl = browserUrlParsed.withQuery(queryString).toString(true);
      this.browser.loadURL(browserUrl);

      this.browser.webContents.on('devtools-reload-page', () => {
        this.isReloading = true;
      });
      this.bindEvents();
    } catch (e) {
      getDebugLogger().error(e);
    }
  }

  async startNode() {
    await this.clear();
    this._nodeReady = new Deferred();
    this.node = new KTNodeProcess(
      this.appConfig.nodeEntry,
      this.appConfig.extensionEntry,
      this.windowClientId,
      this.appConfig.extensionDir,
    );
    this.rpcListenPath = normalizedIpcHandlerPath('electron-window', true);
    await this.node.start(this.rpcListenPath!, (this.workspace || '').toString());
    this._nodeReady.resolve();
  }

  bindEvents() {
    // 外部打开http
    if (semver.lt(process.versions.electron, '13.0.0')) {
      // Deprecated: WebContents new-window event
      // https://www.electronjs.org/docs/latest/breaking-changes#deprecated-webcontents-new-window-event
      this.browser.webContents.on('new-window', (event, url) => {
        if (!event.defaultPrevented) {
          event.preventDefault();
          if (url.indexOf('http') === 0) {
            shell.openExternal(url);
          }
        }
      });
    } else {
      this.browser.webContents.setWindowOpenHandler((details) => {
        if (details.url.indexOf('http') === 0) {
          shell.openExternal(details.url);
        }
        return { action: 'deny' };
      });
    }
  }

  async clear() {
    if (this.node) {
      try {
        await this.node.dispose();
      } catch (error) {
        const logger = getDebugLogger();
        logger.error(error);
      } finally {
        this.node = null;
      }
    }
  }

  close() {
    if (this.browser) {
      this.browser.close();
    }
  }

  getBrowserWindow() {
    return this.browser;
  }

  reload() {
    this.isReloading = true;
    this.browser.webContents.reload();
  }
}

export class KTNodeProcess {
  private _process: ChildProcess;

  private ready: Promise<void>;

  constructor(
    private forkPath: string,
    private extensionEntry: string,
    private windowClientId: string,
    private extensionDir: string,
  ) {}

  async start(rpcListenPath: string, workspace: string | undefined) {
    if (!this.ready) {
      this.ready = new Promise((resolve, reject) => {
        try {
          const forkOptions: ForkOptions = {
            env: {
              ...process.env,
              KTELECTRON: '1',
              ELECTRON_RUN_AS_NODE: '1',
              EXTENSION_HOST_ENTRY: this.extensionEntry,
              EXTENSION_DIR: this.extensionDir,
              CODE_WINDOW_CLIENT_ID: this.windowClientId,
            },
            stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
          };
          const forkArgs: string[] = [];
          forkOptions.env!.WORKSPACE_DIR = workspace;
          forkArgs.push('--listenPath', rpcListenPath);
          this._process = fork(this.forkPath, forkArgs, forkOptions);
          this._process.on('message', (message) => {
            if (message === 'ready') {
              resolve();
            }
          });
          this._process.on('error', (error) => {
            reject(error);
          });
          this._process.stdout.on('data', (data) => {
            data = data.toString();
            if (data.length > 500) {
              data = data.substr(500) + '...';
            }
            process.stdout.write('[node]' + data);
          });
          this._process.stderr.on('data', (data) => {
            data = data.toString();
            if (data.length > 500) {
              data = data.substr(500) + '...';
            }
            process.stdout.write('[node]' + data);
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

  /**
   * 注意：方法需要的时间较长，需要执行完成后再关闭窗口
   */
  async dispose() {
    const logger = getDebugLogger();
    logger.log('KTNodeProcess dispose', this._process.pid);
    if (this._process) {
      return new Promise<void>((resolve, reject) => {
        treeKill(this._process.pid, 'SIGKILL', (err) => {
          if (err) {
            logger.error(`tree kill error \n ${err.message}`);
            reject(err);
          } else {
            logger.log('kill fork process', this._process.pid);
            resolve();
          }
        });
      });
    }
  }
}
