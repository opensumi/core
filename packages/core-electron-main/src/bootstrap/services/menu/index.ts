import { Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@ali/common-di';
import { INativeMenuTemplate, getLogger, Domain } from '@ali/ide-core-common';
import { ElectronMainContribution, ElectronMainApiRegistry, ElectronMainApiProvider } from '../../types';
import { Menu, MenuItemConstructorOptions } from 'electron';

@Injectable()
export class ElectronMainMenuService extends ElectronMainApiProvider<'menuClick' | 'menuClose'> {

  showContextMenu(template: INativeMenuTemplate, webContentsId: number) {
    console.log(template);
    this.buildMenu(template, webContentsId).popup({
      callback: () => {
        this.eventEmitter.fire('menuClick', webContentsId, template.id);
      },
    });
  }

  buildMenu(template: INativeMenuTemplate, webContentsId): Menu {
    const electronTemplate = this.getElectronTemplate(template, webContentsId);
    return Menu.buildFromTemplate(electronTemplate.submenu as MenuItemConstructorOptions[]);
  }

  getElectronTemplate(template: INativeMenuTemplate, webContentsId: string): MenuItemConstructorOptions {
    return {
      label: template.label,
      accelerator: template.accelerator,
      click: template.action ? () => {
        this.eventEmitter.fire('menuClick', webContentsId, template.id);
      } : undefined,
      submenu: template.submenu ? template.submenu.map((t) => this.getElectronTemplate(t, webContentsId)) : undefined,
      type: template.type,

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
