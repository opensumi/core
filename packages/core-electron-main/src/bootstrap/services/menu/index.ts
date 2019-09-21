import { Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@ali/common-di';
import { INativeMenuTemplate, getLogger, Domain, IElectronMainMenuService, isOSX, isWindows } from '@ali/ide-core-common';
import { ElectronMainContribution, ElectronMainApiRegistry, ElectronMainApiProvider } from '../../types';
import { Menu, MenuItemConstructorOptions, BrowserWindow, webContents } from 'electron';

@Injectable()
export class ElectronMainMenuService extends ElectronMainApiProvider<'menuClick' | 'menuClose'> {

  showContextMenu(template: INativeMenuTemplate, webContentsId: number) {
    this.buildMenu(template, webContentsId + '-context').popup({
      callback: () => {
        this.eventEmitter.fire('menuClose', webContentsId, template.id);
      },
    });
  }

  setApplicationMenu(template: INativeMenuTemplate, windowId: number) {
    const menu = this.buildMenu(template, windowId + '-app');
    const window = BrowserWindow.getAllWindows().find((w) => w.id === windowId);
    if (window) {
      if (!isWindows) {
        window.on('focus' , () => {
          Menu.setApplicationMenu(menu);
        });
        if (window.isFocused) {
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
      click: template.action ? () => {
        this.eventEmitter.fire('menuClick', targetId, template.id);
      } : undefined,
      submenu: template.submenu ? template.submenu.map((t) => this.getElectronTemplate(t, targetId)) : undefined,
      type: template.type,
      role: template.role as any,
      enabled: !template.disabled,
    };
  }

}

@Domain(ElectronMainContribution)
export class MenuElectronMainContribution implements ElectronMainContribution {

  @Autowired(INJECTOR_TOKEN)
  injector: Injector;

  registerMainApi(registry: ElectronMainApiRegistry) {
    registry.registerMainApi('menu', this.injector.get(ElectronMainMenuService));
  }

}
