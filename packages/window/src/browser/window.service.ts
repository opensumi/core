import { Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@ali/common-di';
import { IWindowService, IOpenWorkspaceOption } from '../common';
import { isElectronRenderer, URI } from '@ali/ide-core-browser';
import { IElectronMainLifeCycleService } from '@ali/ide-core-common/lib/electron';
import { electronEnv } from '../../../core-browser/lib';

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

  openWorkspace(workspace?: URI, options: IOpenWorkspaceOption = {}): void {
    if (isElectronRenderer()) {
      const electronMainLifecycle: IElectronMainLifeCycleService = this.injector.get(IElectronMainLifeCycleService);
      if (options.newWindow) {
        electronMainLifecycle.openWorkspace(workspace ? workspace.toString() : undefined);
      } else {
        electronMainLifecycle.openWorkspace(workspace ? workspace.toString() : undefined, electronEnv.currentWindowId);
      }
    } else {
      throw new Error('Method not implemented.');
    }
  }
}
