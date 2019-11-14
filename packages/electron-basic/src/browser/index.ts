import { Provider, Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@ali/common-di';
import { BrowserModule, Domain, AppConfig, isOSX, ClientAppContribution, MenuModelRegistry, MAIN_MENU_BAR, IEventBus, IElectronMainMenuService, MenuUpdateEvent, localize, MenuContribution, useNativeContextMenu, SlotLocation, IElectronNativeDialogService, CommandContribution, CommandRegistry, KeybindingContribution, KeybindingRegistry, isWindows, electronEnv, replaceLocalizePlaceholder } from '@ali/ide-core-browser';
import { ComponentContribution, ComponentRegistry } from '@ali/ide-core-browser/lib/layout';
import { IElectronMenuFactory } from '@ali/ide-core-browser/lib/menu';
import { ElectronHeaderBar } from './header';
import { WelcomeContribution } from './welcome/contribution';
import { ElectronNativeDialogService } from './dialog';
import { IElectronMainLifeCycleService } from '@ali/ide-core-common/lib/electron';
import { IMenuRegistry, NextMenuContribution, MenuId } from '@ali/ide-core-browser/lib/menu/next';
import { IElectronMenuBarService } from '@ali/ide-core-browser/lib/menu/next/renderer/ctxmenu/electron';

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
    label: '%window.toggleDevTools%',
    alias: 'Toggle Developer Tools',
  },
];

@Domain(ComponentContribution, ClientAppContribution, NextMenuContribution, CommandContribution, KeybindingContribution)
export class ElectronBasicContribution implements KeybindingContribution, CommandContribution, ComponentContribution, ClientAppContribution, NextMenuContribution {
  @Autowired(AppConfig)
  config: AppConfig;

  @Autowired(INJECTOR_TOKEN)
  injector: Injector;

  @Autowired(IElectronMenuBarService)
  private electronMenuBarService: IElectronMenuBarService;

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

  registerNextMenus(menuRegistry: IMenuRegistry) {
    const menuId = '00_app';
    menuRegistry.registerMenubarItem(menuId, { label: localize('app.name', 'Kaitian') });

    menuRegistry.registerMenuItem(menuId, {
      command: {
        id: 'electron.about',
        label: localize('about'),
      },
      group: '0_about',
      nativeRole: 'about',
    });

    menuRegistry.registerMenuItem(MenuId.MenubarHelpMenu, {
      command: {
        id: 'electron.toggleDevTools',
        label: localize('window.toggleDevTools'),
      },
      nativeRole: 'toggledevtools',
    });

    menuRegistry.registerMenuItem(MenuId.MenubarHelpMenu, {
      command: {
        id: 'electron.reload',
        label: localize('window.reload'),
      },
    });
  }

  registerCommands(commands: CommandRegistry): void {
    nativeRoles.forEach((role) => {
      commands.registerCommand({
        id: 'electron.' + role.name,
        label: replaceLocalizePlaceholder(role.label),
        alias: role.alias,
      }, {
        execute: () => {
          this.electronMainMenuService.runNativeRoleAction(role.name);
        },
      });
    });

    commands.registerCommand({
      id: 'electron.reload',
      label: localize('window.reload'),
      alias: 'Reload Window',
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
      this.electronMenuBarService.start();
    }
  }
}
