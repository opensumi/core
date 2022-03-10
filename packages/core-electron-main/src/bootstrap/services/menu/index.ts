import { Menu, MenuItemConstructorOptions, BrowserWindow } from 'electron';

import { Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@opensumi/di';
import {
  INativeMenuTemplate,
  Domain,
  isWindows,
  IDisposable,
  IElectronMainMenuService,
} from '@opensumi/ide-core-common';

import { ElectronMainContribution, ElectronMainApiRegistry, ElectronMainApiProvider } from '../../types';

@Injectable()
export class ElectronMainMenuService extends ElectronMainApiProvider<'menuClick' | 'menuClose'> {
  private windowAppMenuDisposers = new Map<number, IDisposable>();

  showContextMenu(template: INativeMenuTemplate, webContentsId: number) {
    let menu: Electron.Menu | undefined = this.buildMenu(template, webContentsId + '-context');
    menu!.popup({
      callback: () => {
        menu = undefined;
        this.eventEmitter.fire('menuClose', webContentsId + '-context', template.id);
      },
    });
  }

  setApplicationMenu(template: INativeMenuTemplate, windowId: number) {
    const menu = this.buildMenu(template, windowId + '-app');
    const window = BrowserWindow.fromId(windowId);
    if (window) {
      if (!isWindows) {
        const listener = () => {
          Menu.setApplicationMenu(menu);
        };
        if (this.windowAppMenuDisposers.has(windowId)) {
          this.windowAppMenuDisposers.get(windowId)!.dispose();
        }
        const disposer: IDisposable = {
          dispose: () => {
            this.windowAppMenuDisposers.delete(windowId);
            window.removeListener('focus', listener);
          },
        };
        this.windowAppMenuDisposers.set(windowId, disposer);
        window.on('focus', listener);
        if (window.isFocused()) {
          Menu.setApplicationMenu(menu);
        }
      } else {
        window.setMenu(menu);
      }
    }
  }

  async runNativeRoleAction(actionName: string): Promise<void> {
    const window = BrowserWindow.getFocusedWindow();
    const target = window && window.webContents;
    if (target) {
      if (typeof target[actionName] === 'function') {
        target[actionName]();
      }
    }
  }

  /**
   *
   * @param template
   * @param targetId 目标webcontents或window
   */
  buildMenu(template: INativeMenuTemplate, targetId): Menu {
    const electronTemplate = this.getElectronTemplate(template, targetId);
    return Menu.buildFromTemplate(electronTemplate.submenu as MenuItemConstructorOptions[]);
  }

  getElectronTemplate(template: INativeMenuTemplate, targetId: string): MenuItemConstructorOptions {
    return {
      label: template.label,
      accelerator: template.accelerator,
      click: template.action
        ? () => {
            this.eventEmitter.fire('menuClick', targetId, template.id);
          }
        : undefined,
      submenu: template.submenu ? template.submenu.map((t) => this.getElectronTemplate(t, targetId)) : undefined,
      type: template.type,
      role: template.role as any,
      enabled: !template.disabled,
      checked: template.checked,
    };
  }
}

@Domain(ElectronMainContribution)
export class MenuElectronMainContribution implements ElectronMainContribution {
  @Autowired(INJECTOR_TOKEN)
  injector: Injector;

  registerMainApi(registry: ElectronMainApiRegistry) {
    registry.registerMainApi(IElectronMainMenuService, this.injector.get(ElectronMainMenuService));
  }
}
