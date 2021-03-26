import { Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@ali/common-di';
import { IWindowService, IOpenWorkspaceOption, NewWindowOptions } from '.';
import { isElectronRenderer, URI } from '@ali/ide-core-common';
import { IElectronMainLifeCycleService, IElectronMainUIService } from '@ali/ide-core-common/lib/electron';
import { electronEnv } from '../utils/electron';
import { IExternalUriService } from '../services';

@Injectable()
export class WindowService implements IWindowService {

  @Autowired(INJECTOR_TOKEN)
  private readonly injector: Injector;

  @Autowired(IExternalUriService)
  private readonly externalUriService: IExternalUriService;

  openNewWindow(url: string, options?: NewWindowOptions): Window | undefined {
    if (options?.external) {
      url = this.externalUriService.resolveExternalUri(new URI(url)).toString(true);
    }
    if (isElectronRenderer()) {
      // Electron 环境下使用 shell.openExternal 方法打开外部U ri
      const electronMainUIService: IElectronMainUIService = this.injector.get(IElectronMainUIService);
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
    if (isElectronRenderer()) {
      const electronMainLifecycle: IElectronMainLifeCycleService = this.injector.get(IElectronMainLifeCycleService);
      if (options.newWindow) {
        electronMainLifecycle.openWorkspace(workspace.toString());
      } else {
        electronMainLifecycle.openWorkspace(workspace.toString(), { windowId: electronEnv.currentWindowId, replace: true });
      }
    } else {
      throw new Error('Method not implemented.');
    }
  }

  close(): void {
    if (isElectronRenderer()) {
      // 防止 node 进程被先关闭掉，导致再也无法关闭
      window.close();
    } else {
      throw new Error('Method not implemented.');
    }
  }

  maximize(): void {
    if (isElectronRenderer()) {
      const electronMainLifecycle: IElectronMainLifeCycleService = this.injector.get(IElectronMainLifeCycleService);
      electronMainLifecycle.maximizeWindow(electronEnv.currentWindowId);
    } else {
      throw new Error('Method not implemented.');
    }
  }

  unmaximize(): void {
    if (isElectronRenderer()) {
      const electronMainLifecycle: IElectronMainLifeCycleService = this.injector.get(IElectronMainLifeCycleService);
      electronMainLifecycle.unmaximizeWindow(electronEnv.currentWindowId);
    } else {
      throw new Error('Method not implemented.');
    }
  }

  fullscreen(): void {
    if (isElectronRenderer()) {
      const electronMainLifecycle: IElectronMainLifeCycleService = this.injector.get(IElectronMainLifeCycleService);
      electronMainLifecycle.fullscreenWindow(electronEnv.currentWindowId);
    } else {
      throw new Error('Method not implemented.');
    }
  }

  minimize(): void {
    if (isElectronRenderer()) {
      const electronMainLifecycle: IElectronMainLifeCycleService = this.injector.get(IElectronMainLifeCycleService);
      electronMainLifecycle.minimizeWindow(electronEnv.currentWindowId);
    } else {
      throw new Error('Method not implemented.');
    }
  }
}
