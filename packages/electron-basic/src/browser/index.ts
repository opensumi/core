import { Provider, Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@ali/common-di';
import { BrowserModule, Domain, AppConfig, isOSX, ClientAppContribution, MenuModelRegistry, MAIN_MENU_BAR, IEventBus, IElectronMainMenuService, MenuUpdateEvent, COMMON_MENUS, localize, MenuContribution, useNativeContextMenu } from '@ali/ide-core-browser';
import { LayoutContribution, ComponentRegistry } from '@ali/ide-core-browser/lib/layout';
import { SlotLocation } from '@ali/ide-main-layout';
import { IElectronMenuFactory } from '@ali/ide-core-browser/lib/menu';
import { ElectronHeaderBar } from './header';

@Injectable()
export class ElectronBasicModule extends BrowserModule {
  providers: Provider[] = [
    ElectronBasicContribution,
  ];
}

@Domain(LayoutContribution, ClientAppContribution, MenuContribution)
export class ElectronBasicContribution implements LayoutContribution, ClientAppContribution, MenuContribution {
  @Autowired(AppConfig)
  config: AppConfig;

  @Autowired(INJECTOR_TOKEN)
  injector: Injector;

  @Autowired(IElectronMenuFactory)
  private electronMenuFactory: IElectronMenuFactory;

  registerComponent(registry: ComponentRegistry) {
    const top = this.config.layoutConfig[SlotLocation.top];
    if ( top && top.modules  ) {
      const index = top.modules.indexOf('@ali/ide-menu-bar');
      if (index !== -1) {
        top.modules.splice(index, 1, 'electron-header');
      }
    }
    registry.register('electron-header', {
      id: 'electron-header',
      component: ElectronHeaderBar,
    }, {
      size: 27,
    });
  }

  registerMenus(menuRegistry: MenuModelRegistry) {
    menuRegistry.registerSubmenu([...MAIN_MENU_BAR, '00_app'], 'APP NAME');

    menuRegistry.registerMenuAction([...MAIN_MENU_BAR, '00_app'], {
      label: localize('about'),
      nativeRole: 'about',
      commandId: 'electron.about',
    });

    menuRegistry.registerMenuAction([...COMMON_MENUS.HELP], {
      nativeRole: 'toggledevtools',
      commandId: 'electron.toggledevtools',
    });

    menuRegistry.registerMenuAction([...COMMON_MENUS.HELP], {
      nativeRole: 'reload',
      commandId: 'electron.reload',
    });
  }

  onStart() {
    if (isOSX) {
      this.electronMenuFactory.setApplicationMenu(MAIN_MENU_BAR);
      this.injector.get(IEventBus).on(MenuUpdateEvent, (e) => {
        if (e.payload && e.payload[0] === MAIN_MENU_BAR[0]) {
          this.electronMenuFactory.setApplicationMenu(MAIN_MENU_BAR);
        }
      });
    }
  }
}
