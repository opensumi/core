import { Autowired, INJECTOR_TOKEN, Injectable, Injector } from '@opensumi/di';
import { URI } from '@opensumi/ide-core-common';
import { IElectronMainLifeCycleService, IElectronMainUIService } from '@opensumi/ide-core-common/lib/electron';

import { Logger } from '../logger';
import { AppConfig } from '../react-providers/config-provider';
import { IExternalUriService } from '../services';
import { electronEnv } from '../utils/electron';

import { IOpenWorkspaceOption, IWindowService, NewWindowOptions } from '.';

@Injectable()
export class WindowService implements IWindowService {
  @Autowired(INJECTOR_TOKEN)
  private readonly injector: Injector;

  @Autowired(AppConfig)
  private readonly appConfig: AppConfig;

  @Autowired()
  private logger: Logger;

  openNewWindow(url: string, options?: NewWindowOptions): Window | undefined {
    if (this.appConfig.isElectronRenderer) {
      // Electron 环境下使用 shell.openExternal 方法打开外部 Uri
      const electronMainUIService: IElectronMainUIService = this.injector.get(IElectronMainUIService);
      // TODO: 由于 electron 下没有打开外部的警告（静默打开），此处直接 openExternal 可能会存在一定的安全隐患
      // 需要给用户添加一点提示。 或者这个也可以统一做到 OpenerService 里面。
      electronMainUIService.openExternal(url);
      return undefined;
    } else {
      if (options?.external) {
        const externalUriService = this.injector.get(IExternalUriService);
        url = externalUriService.resolveExternalUri(new URI(url)).toString(true);
      }
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
      try {
        const workspaceUri = new URI(workspace.toString());
        let workspacePath: string;
        if (workspaceUri.scheme === 'file') {
          workspacePath = workspaceUri.codeUri.fsPath;
        } else {
          workspacePath = workspaceUri.path.toString();
        }
        if (!workspacePath) {
          throw new Error('Invalid workspace path');
        }
        const url = `${window.location.protocol}//${window.location.host}?workspaceDir=${encodeURIComponent(
          workspacePath,
        )}`;
        this.logger.debug(`Opening workspace with URL: ${url}`);
        if (options.newWindow) {
          const newWindow = window.open(url);
          if (!newWindow) {
            this.logger.error('Failed to open new window');
            throw new Error('Unable to open new window, please check if your browser blocks pop-ups');
          }
        } else {
          parent.window.location.href = url;
        }
      } catch (error) {
        this.logger.error('Failed to open workspace:', error);
        throw error;
      }
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
