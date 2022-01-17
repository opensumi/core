import { Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@opensumi/di';
import { IWindowService, IOpenWorkspaceOption, NewWindowOptions } from '.';
import { URI } from '@opensumi/ide-core-common';
import { IElectronMainLifeCycleService, IElectronMainUIService } from '@opensumi/ide-core-common/lib/electron';
import { electronEnv } from '../utils/electron';
import { IExternalUriService } from '../services';
import { AppConfig } from '../react-providers';

@Injectable()
export class WindowService implements IWindowService {
  @Autowired(INJECTOR_TOKEN)
  private readonly injector: Injector;

  @Autowired(IExternalUriService)
  private readonly externalUriService: IExternalUriService;

  @Autowired(AppConfig)
  private readonly appConfig: AppConfig;

  openNewWindow(url: string, options?: NewWindowOptions): Window | undefined {
    if (options?.external) {
      url = this.externalUriService.resolveExternalUri(new URI(url)).toString(true);
    }
    if (this.appConfig.isElectronRenderer) {
      // Electron 环境下使用 shell.openExternal 方法打开外部 Uri
      const electronMainUIService: IElectronMainUIService = this.injector.get(IElectronMainUIService);
      // TODO: 由于 electron 下没有打开外部的警告（静默打开），此处直接 openExternal 可能会存在一定的安全隐患
      // 需要给用户添加一点提示。 或者这个也可以统一做到 OpenerService 里面。
      electronMainUIService.openExternal(url);
      return undefined;
    } else {
      const newWindow = window.open(url);
      if (newWindow === null) {
        throw new Error('Cannot open a new window for URL: ' + url);
      }
      return newWindow;
    }
  }

  openWorkspace(workspace: URI, options: IOpenWorkspaceOption = {}): void {
    if (this.appConfig.isElectronRenderer) {
      const electronMainLifecycle: IElectronMainLifeCycleService = this.injector.get(IElectronMainLifeCycleService);
      if (options.newWindow) {
        electronMainLifecycle.openWorkspace(workspace.toString());
      } else {
        electronMainLifecycle.openWorkspace(workspace.toString(), {
          windowId: electronEnv.currentWindowId,
          replace: true,
        });
      }
    } else {
      throw new Error('Method not implemented.');
    }
  }

  close(): void {
    if (this.appConfig.isElectronRenderer) {
      // 防止 node 进程被先关闭掉，导致再也无法关闭
      window.close();
    } else {
      throw new Error('Method not implemented.');
    }
  }

  maximize(): void {
    if (this.appConfig.isElectronRenderer) {
      const electronMainLifecycle: IElectronMainLifeCycleService = this.injector.get(IElectronMainLifeCycleService);
      electronMainLifecycle.maximizeWindow(electronEnv.currentWindowId);
    } else {
      throw new Error('Method not implemented.');
    }
  }

  unmaximize(): void {
    if (this.appConfig.isElectronRenderer) {
      const electronMainLifecycle: IElectronMainLifeCycleService = this.injector.get(IElectronMainLifeCycleService);
      electronMainLifecycle.unmaximizeWindow(electronEnv.currentWindowId);
    } else {
      throw new Error('Method not implemented.');
    }
  }

  fullscreen(): void {
    if (this.appConfig.isElectronRenderer) {
      const electronMainLifecycle: IElectronMainLifeCycleService = this.injector.get(IElectronMainLifeCycleService);
      electronMainLifecycle.fullscreenWindow(electronEnv.currentWindowId);
    } else {
      throw new Error('Method not implemented.');
    }
  }

  minimize(): void {
    if (this.appConfig.isElectronRenderer) {
      const electronMainLifecycle: IElectronMainLifeCycleService = this.injector.get(IElectronMainLifeCycleService);
      electronMainLifecycle.minimizeWindow(electronEnv.currentWindowId);
    } else {
      throw new Error('Method not implemented.');
    }
  }
}
