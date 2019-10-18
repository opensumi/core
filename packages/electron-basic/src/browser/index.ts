import { Provider, Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@ali/common-di';
import { BrowserModule, Domain, AppConfig, isOSX, ClientAppContribution, MenuModelRegistry, MAIN_MENU_BAR, IEventBus, IElectronMainMenuService, MenuUpdateEvent, COMMON_MENUS, localize, MenuContribution, useNativeContextMenu, SlotLocation, IElectronNativeDialogService, CommandContribution, CommandRegistry, KeybindingContribution, KeybindingRegistry, isWindows, electronEnv } from '@ali/ide-core-browser';
import { ComponentContribution, ComponentRegistry } from '@ali/ide-core-browser/lib/layout';
import { IElectronMenuFactory } from '@ali/ide-core-browser/lib/menu';
import { ElectronHeaderBar } from './header';
import { WelcomeContribution } from './welcome/contribution';
import { ElectronNativeDialogService } from './dialog';
import { IElectronMainLifeCycleService } from '@ali/ide-core-common/lib/electron';

@Injectable()
export class ElectronBasicModule extends BrowserModule {
  providers: Provider[] = [
    {
      token: IElectronNativeDialogService,
      useClass: ElectronNativeDialogService,
    },
    ElectronBasicContribution,
    WelcomeContribution,
  ];
}

const nativeRoles = [
  {
    name: 'undo',
    key: 'ctrlcmd+z',
    when: '!editorFocus',
  },
  {
    name: 'redo',
    key: 'ctrlcmd+shift+z',
    when: '!editorFocus',
  },
  {
    name: 'copy',
    key: 'ctrlcmd+c',
    when: '!editorFocus',
  },
  {
    name: 'paste',
    key: 'ctrlcmd+v',
    when: '!editorFocus',
  },
  {
    name: 'cut',
    key: 'ctrlcmd+x',
    when: '!editorFocus',
  },
  {
    name: 'toggleDevTools',
    key: 'alt+ctrlcmd+i',
  },
];

@Domain(ComponentContribution, ClientAppContribution, MenuContribution, CommandContribution, KeybindingContribution)
export class ElectronBasicContribution implements KeybindingContribution, CommandContribution, ComponentContribution, ClientAppContribution, MenuContribution {

  @Autowired(AppConfig)
  config: AppConfig;

  @Autowired(INJECTOR_TOKEN)
  injector: Injector;

  @Autowired(IElectronMenuFactory)
  private electronMenuFactory: IElectronMenuFactory;

  @Autowired(IElectronMainMenuService)
  private electronMainMenuService: IElectronMainMenuService;

  @Autowired(IElectronMainLifeCycleService)
  private electronMainLifeCycleService: IElectronMainLifeCycleService;

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
      containerId: 'electron-header',
    });
  }

  registerMenus(menuRegistry: MenuModelRegistry) {
    menuRegistry.registerSubmenu([...MAIN_MENU_BAR, '00_app'], localize('app.name', 'Kaitian'));

    menuRegistry.registerMenuAction([...MAIN_MENU_BAR, '00_app'], {
      order: '0_about',
      label: localize('about'),
      nativeRole: 'about',
      commandId: 'electron.about',
    });

    menuRegistry.registerMenuAction([...COMMON_MENUS.HELP], {
      nativeRole: 'toggledevtools',
      commandId: 'electron.toggleDevTools',
      label: localize('window.toggleDevTools'),
    });

    menuRegistry.registerMenuAction([...COMMON_MENUS.HELP], {
      nativeRole: 'reload',
      commandId: 'electron.reload',
      label: localize('window.reload'),
    });
  }

  registerCommands(commands: CommandRegistry): void {
    nativeRoles.forEach((role) => {
      commands.registerCommand({
        id: 'electron.' + role.name,
      }, {
        execute: () => {
          this.electronMainMenuService.runNativeRoleAction(role.name);
        },
      });
    });

    commands.registerCommand({
      id: 'electron.reload',
    }, {
      execute: () => {
        this.electronMainLifeCycleService.reloadWindow(electronEnv.currentWindowId);
      },
    });
  }

  registerKeybindings(keybindings: KeybindingRegistry) {
    nativeRoles.forEach((role) => {
      if (role.key) {
        keybindings.registerKeybinding({
          command: 'electron.' + role.name,
          keybinding: role.key,
          when: role.when,
        });
      }
    });

    keybindings.registerKeybinding({
      command: 'electron.reload' ,
      keybinding: 'shift+ctrlcmd+r',
    });
  }

  onStart() {
    if (isOSX) {
      this.electronMenuFactory.setApplicationMenu(MAIN_MENU_BAR);
      const eventBus = this.injector.get(IEventBus);
      eventBus.on(MenuUpdateEvent, (e) => {
        if (e.payload && e.payload[0] === MAIN_MENU_BAR[0]) {
          this.electronMenuFactory.setApplicationMenu(MAIN_MENU_BAR);
        }
      });
    }
  }
}
