import { Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@ali/common-di';
import { IWindowService, IOpenWorkspaceOption } from '../common';
import { isElectronRenderer, URI } from '@ali/ide-core-browser';
import { IElectronMainLifeCycleService } from '@ali/ide-core-common/lib/electron';
import { electronEnv } from '@ali/ide-core-browser';

@Injectable()
export class WindowServiceImpl implements IWindowService {

  @Autowired(INJECTOR_TOKEN)
  injector: Injector;

  openNewWindow(url: string): Window | undefined {
    const newWindow = window.open(url);
    if (newWindow === null) {
      throw new Error('Cannot open a new window for URL: ' + url);
    }
    return newWindow;
  }

  openWorkspace(workspace: URI, options: IOpenWorkspaceOption = {}): void {
    if (isElectronRenderer()) {
      const electronMainLifecycle: IElectronMainLifeCycleService = this.injector.get(IElectronMainLifeCycleService);
      if (options.newWindow) {
        electronMainLifecycle.openWorkspace(workspace.toString(), { windowId: electronEnv.currentWindowId });
      } else {
        electronMainLifecycle.openWorkspace(workspace.toString(), { windowId: electronEnv.currentWindowId, replace: true });
      }
    } else {
      throw new Error('Method not implemented.');
    }
  }

  close(): void {
    if (isElectronRenderer()) {
      const electronMainLifecycle: IElectronMainLifeCycleService = this.injector.get(IElectronMainLifeCycleService);
      electronMainLifecycle.closeWindow(electronEnv.currentWindowId);
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
