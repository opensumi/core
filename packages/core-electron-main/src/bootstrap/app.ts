import { app, BrowserWindow, BrowserWindowConstructorOptions } from 'electron';
import { argv } from 'yargs';

import { Injector, ConstructorOf } from '@opensumi/di';
import {
  createContributionProvider,
  ContributionProvider,
  URI,
  ExtensionCandidate,
  IEventBus,
  EventBusImpl,
  asExtensionCandidate,
} from '@opensumi/ide-core-common';
import { IElectronMainLifeCycleService } from '@opensumi/ide-core-common/lib/electron';

import { ElectronMainModule } from '../electron-main-module';

import { ElectronMainApiRegistryImpl, ElectronURLHandlerRegistryImpl } from './api';
import { serviceProviders } from './services';
import { WindowDestroyedEvent, WindowCreatedEvent } from './services/events';
import { ICodeWindowOptions } from './types';
import {
  ElectronAppConfig,
  ElectronMainApiRegistry,
  ElectronMainContribution,
  IElectronMainApp,
  IElectronMainApiProvider,
  IParsedArgs,
  ElectronURLHandlerRegistry,
} from './types';
import { CodeWindow } from './window';

export interface IWindowOpenOptions {
  windowId: number;
  // @deprecated
  replace?: boolean;
}

export class ElectronMainApp {
  private codeWindows: Map<number, CodeWindow> = new Map();

  private injector: Injector;

  private modules: ElectronMainModule[] = [];

  private parsedArgs: IParsedArgs = {
    extensionDir: argv.extensionDir as string | undefined,
    extensionCandidate: argv.extensionCandidate
      ? Array.isArray(argv.extensionCandidate)
        ? argv.extensionCandidate
        : [argv.extensionCandidate]
      : [],
    extensionDevelopmentPath: argv.extensionDevelopmentPath as string | undefined,
  };

  constructor(private config: ElectronAppConfig) {
    this.injector = config.injector || new Injector();
    config.extensionDir = this.parsedArgs.extensionDir ? this.parsedArgs.extensionDir : config.extensionDir || '';
    config.extensionCandidate = [
      ...config.extensionCandidate,
      ...this.parsedArgs.extensionCandidate.map((e) => asExtensionCandidate(e, false)),
    ];

    if (this.parsedArgs.extensionDevelopmentPath) {
      config.extensionCandidate = config.extensionCandidate.concat(
        Array.isArray(this.parsedArgs.extensionDevelopmentPath)
          ? this.parsedArgs.extensionDevelopmentPath.map((e) => asExtensionCandidate(e, true))
          : [asExtensionCandidate(this.parsedArgs.extensionDevelopmentPath, true)],
      );
    }

    config.extensionDevelopmentHost = !!this.parsedArgs.extensionDevelopmentPath;

    this.injector.addProviders(
      {
        token: IEventBus,
        useClass: EventBusImpl,
      },
      {
        token: ElectronAppConfig,
        useValue: config,
      },
      {
        token: IElectronMainApp,
        useValue: this,
      },
      {
        token: ElectronURLHandlerRegistry,
        useClass: ElectronURLHandlerRegistryImpl,
      },
      {
        token: ElectronMainApiRegistry,
        useClass: ElectronMainApiRegistryImpl,
      },
      ...serviceProviders,
    );
    this.injectLifecycleApi();
    createContributionProvider(this.injector, ElectronMainContribution);
    this.createElectronMainModules(this.config.modules);
    this.onBeforeReadyContribution();
    this.registerMainApis();
    this.registerURLHandlers();
  }

  async init() {
    await app.whenReady().then(() => {
      this.onStartContribution();
    });
  }

  registerMainApis() {
    for (const contribution of this.contributions) {
      if (contribution.registerMainApi) {
        contribution.registerMainApi(this.injector.get(ElectronMainApiRegistry));
      }
    }
  }

  registerURLHandlers() {
    for (const contribution of this.contributions) {
      if (contribution.registerURLHandler) {
        contribution.registerURLHandler(this.injector.get(ElectronURLHandlerRegistry));
      }
    }
  }

  onStartContribution() {
    for (const contribution of this.contributions) {
      if (contribution.onStart) {
        contribution.onStart();
      }
    }
  }

  onBeforeReadyContribution() {
    for (const contribution of this.contributions) {
      if (contribution.beforeAppReady) {
        contribution.beforeAppReady();
      }
    }
  }

  loadWorkspace(
    workspace?: string,
    metadata: any = {},
    options: BrowserWindowConstructorOptions & ICodeWindowOptions = {},
    openOptions?: IWindowOpenOptions,
  ): CodeWindow {
    const formattedWorkspace = this.formatWorkspace(workspace);
    if (openOptions && openOptions.windowId) {
      const lastWindow = this.getCodeWindowByElectronBrowserWindowId(openOptions.windowId);
      if (lastWindow) {
        lastWindow.setWorkspace(formattedWorkspace!);
        lastWindow.metadata = metadata;
        lastWindow.reload();
        return lastWindow;
      }
    }
    const window = this.injector.get(CodeWindow, [formattedWorkspace, metadata, options]);
    window.start();
    if (options.show !== false) {
      window.getBrowserWindow().show();
    }
    const windowId = window.getBrowserWindow().id;
    this.codeWindows.set(windowId, window);
    window.addDispose({
      dispose: () => {
        this.injector.get(IEventBus).fire(new WindowDestroyedEvent(window));
        this.codeWindows.delete(windowId);
      },
    });
    this.injector.get(IEventBus).fire(new WindowCreatedEvent(window));

    return window;
  }

  get contributions() {
    return (
      this.injector.get(ElectronMainContribution) as ContributionProvider<ElectronMainContribution>
    ).getContributions();
  }

  getCodeWindows() {
    return Array.from(this.codeWindows.values());
  }

  getCodeWindowByElectronBrowserWindowId(id: number) {
    for (const window of this.getCodeWindows()) {
      if (window.getBrowserWindow() && window.getBrowserWindow().id === id) {
        return window;
      }
    }
  }

  getCodeWindowByWorkspace(workspace: string) {
    const normalizeUri = URI.isUriString(workspace) ? URI.parse(workspace) : URI.file(workspace);
    for (const codeWindow of this.getCodeWindows()) {
      if (codeWindow.workspace && codeWindow.workspace.toString() === normalizeUri.toString()) {
        return codeWindow;
      }
    }
  }

  private createElectronMainModules(Constructors: Array<ConstructorOf<ElectronMainModule>> = []) {
    for (const Constructor of Constructors) {
      this.modules.push(this.injector.get(Constructor));
    }
    for (const instance of this.modules) {
      if (instance.providers) {
        this.injector.addProviders(...instance.providers);
      }

      if (instance.contributionProvider) {
        if (Array.isArray(instance.contributionProvider)) {
          for (const contributionProvider of instance.contributionProvider) {
            createContributionProvider(this.injector, contributionProvider);
          }
        } else {
          createContributionProvider(this.injector, instance.contributionProvider);
        }
      }
    }
  }

  private injectLifecycleApi() {
    const registry: ElectronMainApiRegistry = this.injector.get(ElectronMainApiRegistry);
    registry.registerMainApi(IElectronMainLifeCycleService, new ElectronMainLifeCycleApi(this));
  }

  /**
   * 兼容不规范的 url 比如 Windows "file://C:\\path\\to\\測試.html?background=#hash=title1"
   * 要转换为 c:\path\to\測試.html
   * @param workspace
   * @returns string | undefined
   */
  private formatWorkspace(workspace?: string): string | undefined {
    if (!workspace) {
      return undefined;
    }
    if (URI.isUriString(workspace)) {
      // 注意这里如果有 unicode 的字符，获取正确的路径:
      // 需要 URI.parse().codeUri.fsPath 或者 URI.parse().codeUri.toString(true)
      return new URL(workspace).toString();
    } else {
      return URI.file(workspace).toString();
    }
  }
}

class ElectronMainLifeCycleApi implements IElectronMainApiProvider<void> {
  eventEmitter: undefined;

  constructor(private app: ElectronMainApp) {}

  openWorkspace(workspace: string, openOptions: IWindowOpenOptions) {
    if (workspace) {
      for (const window of this.app.getCodeWindows()) {
        if (window.workspace && window.workspace.toString() === workspace) {
          window.getBrowserWindow().show();
          return;
        }
      }
    }
    this.app.loadWorkspace(workspace, {}, {}, openOptions);
  }

  minimizeWindow(windowId: number) {
    const window = BrowserWindow.fromId(windowId);
    if (window) {
      window.minimize();
    }
  }

  fullscreenWindow(windowId: number) {
    const window = BrowserWindow.fromId(windowId);
    if (window) {
      window.setFullScreen(true);
    }
  }
  maximizeWindow(windowId: number) {
    const window = BrowserWindow.fromId(windowId);
    if (window) {
      window.maximize();
    }
  }

  unmaximizeWindow(windowId: number) {
    const window = BrowserWindow.fromId(windowId);
    if (window) {
      window.unmaximize();
    }
  }
  closeWindow(windowId: number) {
    const window = BrowserWindow.fromId(windowId);
    if (window) {
      const codeWindow = this.app.getCodeWindowByElectronBrowserWindowId(windowId);
      if (!codeWindow) {
        window.close();
        return;
      }

      if (codeWindow.isReloading) {
        codeWindow.isReloading = false;

        if (!codeWindow.isRemote) {
          // reload 的情况下不需要等待 startNode 执行完
          // 所以可以同时执行 startNode 和 reload 前端
          codeWindow.startNode();
        }
        window.webContents.reload();
      } else {
        // 正常关闭窗口的情况下，需要回收子进程，耗时可能会比较长
        // 这里先隐藏窗口，体感会更快
        window.hide();
        codeWindow.clear().finally(() => {
          window.close();
        });
      }
    }
  }

  reloadWindow(windowId: number) {
    const codeWindow = this.app.getCodeWindowByElectronBrowserWindowId(windowId);
    if (codeWindow) {
      codeWindow.reload();
    }
  }

  setExtensionDir(extensionDir: string, windowId: number) {
    const window = BrowserWindow.fromId(windowId);
    if (window) {
      const codeWindow = this.app.getCodeWindowByElectronBrowserWindowId(windowId);
      if (codeWindow) {
        codeWindow.setExtensionDir(extensionDir);
      }
    }
  }

  setExtensionCandidate(candidate: ExtensionCandidate[], windowId: number) {
    const window = BrowserWindow.fromId(windowId);
    if (window) {
      const codeWindow = this.app.getCodeWindowByElectronBrowserWindowId(windowId);
      if (codeWindow) {
        codeWindow.setExtensionCandidate(candidate);
      }
    }
  }
}
